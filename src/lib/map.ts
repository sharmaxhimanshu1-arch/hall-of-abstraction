import { STANCES } from '../content.config';
import { getIdeologies, getThinkers, type Thinker } from './content';

type Stance = (typeof STANCES)[number];
export type EdgeKind = 'influence' | 'agreed' | 'argued';

/** Canvas geometry for the timeline, in SVG user units. */
export const MAP = {
  width: 780,
  left: 34,
  right: 756,
  top: 44,
  rowHeight: 72,
  bottom: 16,
  minGap: 36,
  /** The ancient world is squeezed into the left part of the axis. */
  ancient: { from: -600, to: 200, share: 0.28 },
  breakWidth: 26,
  modern: { from: 1550, to: 1950 },
} as const;

const plotLeft = MAP.left;
const plotWidth = MAP.right - plotLeft;
const ancientEnd = plotLeft + plotWidth * MAP.ancient.share;
const modernStart = ancientEnd + MAP.breakWidth;

/** Maps a year (negative = BCE) onto the two-part time axis. */
export function yearToX(year: number): number {
  const { ancient, modern } = MAP;
  if (year <= ancient.to) {
    const t = (year - ancient.from) / (ancient.to - ancient.from);
    return plotLeft + Math.max(0, t) * (ancientEnd - plotLeft);
  }
  const t = (year - modern.from) / (modern.to - modern.from);
  return modernStart + Math.min(1, Math.max(0, t)) * (MAP.right - modernStart);
}

export const axisBreak = { x1: ancientEnd, x2: modernStart };

export const ticks = [
  { year: -500, label: '500 BCE' },
  { year: 1, label: '1 CE' },
  { year: 1600, label: '1600' },
  { year: 1700, label: '1700' },
  { year: 1800, label: '1800' },
  { year: 1900, label: '1900' },
].map((t) => ({ ...t, x: yearToX(t.year) }));

const SHORT_NAMES: Record<string, string> = {
  'siddhartha-gautama': 'Buddha',
  'marcus-aurelius': 'Marcus Aurelius',
  'simone-de-beauvoir': 'Beauvoir',
};

export const shortName = (t: Thinker) => SHORT_NAMES[t.id] ?? t.data.name.split(' ').at(-1)!;

const FLIP: Record<Stance, Stance> = {
  'learned-from': 'built-on-by',
  'built-on-by': 'learned-from',
  challenged: 'challenged-by',
  'challenged-by': 'challenged',
  agreed: 'agreed',
};

const KIND: Record<Stance, EdgeKind> = {
  'learned-from': 'influence',
  'built-on-by': 'influence',
  agreed: 'agreed',
  challenged: 'argued',
  'challenged-by': 'argued',
};

/** When a pair is linked in more than one way, the line shows the strongest. */
const KIND_RANK: Record<EdgeKind, number> = { influence: 3, argued: 2, agreed: 1 };

export interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  labelBelow: boolean;
  thinker: Thinker;
}

export interface MapEdge {
  a: string;
  b: string;
  kind: EdgeKind;
  path: string;
}

export interface MapConnection {
  other: string;
  stance: Stance;
  /** The thinker's own note about the other, else the other's note about them. */
  note?: string;
}

export async function getMapData() {
  const thinkers = await getThinkers();
  const used = new Set(thinkers.map((t) => t.data.primary.id));
  const rows = (await getIdeologies())
    .filter((i) => used.has(i.id))
    .map((ideology, i) => ({ ideology, y: MAP.top + MAP.rowHeight * (i + 0.5) }));
  const height = MAP.top + MAP.rowHeight * rows.length + MAP.bottom;

  // Place each thinker on its row, then push apart dots that would overlap.
  const nodes: MapNode[] = [];
  for (const row of rows) {
    const members = thinkers
      .filter((t) => t.data.primary.id === row.ideology.id)
      .sort((a, b) => a.data.born - b.data.born)
      .map((t) => ({ t, x: yearToX(t.data.born) }));
    for (let i = 1; i < members.length; i++) {
      members[i]!.x = Math.max(members[i]!.x, members[i - 1]!.x + MAP.minGap);
    }
    const overflow = (members.at(-1)?.x ?? 0) - MAP.right;
    if (overflow > 0) for (const m of members) m.x -= overflow;

    let prevBelow = false;
    members.forEach((m, i) => {
      const close = i > 0 && m.x - members[i - 1]!.x < 78;
      const labelBelow = close ? !prevBelow : true;
      prevBelow = labelBelow;
      nodes.push({
        id: m.t.id,
        label: shortName(m.t),
        x: m.x,
        y: row.y,
        color: row.ideology.data.color,
        labelBelow,
        thinker: m.t,
      });
    });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Every relationship, seen from both sides, with the notes each side wrote.
  const connections = new Map<string, Map<string, MapConnection & { own: boolean }>>();
  const addConnection = (
    from: string,
    other: string,
    stance: Stance,
    note?: string,
    own = true,
  ) => {
    const list = connections.get(from) ?? new Map<string, MapConnection & { own: boolean }>();
    connections.set(from, list);
    const key = `${other}|${stance}`;
    const entry = list.get(key);
    if (!entry || (own && !entry.own) || (!entry.note && note)) {
      list.set(key, { other, stance, note: note ?? entry?.note, own: own || !!entry?.own });
    }
  };
  const pairKind = new Map<string, EdgeKind>();
  const addPair = (a: string, b: string, kind: EdgeKind) => {
    const key = [a, b].sort().join('|');
    const current = pairKind.get(key);
    if (!current || KIND_RANK[kind] > KIND_RANK[current]) pairKind.set(key, kind);
  };

  for (const t of thinkers) {
    for (const c of t.data.conversations) {
      addConnection(t.id, c.thinker.id, c.stance, c.note);
      addConnection(c.thinker.id, t.id, FLIP[c.stance], c.note, false);
      addPair(t.id, c.thinker.id, KIND[c.stance]);
    }
  }
  // Older influence links that have no matching conversation entry.
  for (const t of thinkers) {
    for (const ref of t.data.influencedBy) {
      const has = connections.get(t.id)?.has(`${ref.id}|learned-from`);
      if (!has) {
        addConnection(t.id, ref.id, 'learned-from');
        addConnection(ref.id, t.id, 'built-on-by', undefined, false);
      }
      addPair(t.id, ref.id, 'influence');
    }
  }

  const edges: MapEdge[] = [...pairKind].map(([key, kind]) => {
    const [a, b] = key.split('|') as [string, string];
    const p = byId.get(a)!;
    const q = byId.get(b)!;
    const [s, e] = p.x <= q.x ? [p, q] : [q, p];
    let path: string;
    if (s.y === e.y) {
      const lift = Math.min(46, 12 + (e.x - s.x) * 0.18);
      path = `M${s.x} ${s.y} Q${(s.x + e.x) / 2} ${s.y - lift * 2} ${e.x} ${e.y}`;
    } else {
      const midY = (s.y + e.y) / 2;
      path = `M${s.x} ${s.y} C${s.x} ${midY} ${e.x} ${midY} ${e.x} ${e.y}`;
    }
    return { a, b, kind, path: path.replace(/(\d+\.\d)\d+/g, '$1') };
  });
  // Draw the faint kinds first so influence lines sit on top.
  edges.sort((x, y) => KIND_RANK[x.kind] - KIND_RANK[y.kind]);

  const order = new Map(STANCES.map((s, i) => [s, i]));
  const connectionsOf = (id: string) =>
    [...(connections.get(id)?.values() ?? [])]
      .map(({ own: _own, ...c }): MapConnection => c)
      .sort(
      (x, y) =>
        order.get(x.stance)! - order.get(y.stance)! ||
        byId.get(x.other)!.thinker.data.born - byId.get(y.other)!.thinker.data.born,
    );

  // Put each row's title on the side away from its thinkers.
  const rowsOut = rows.map((r) => {
    const xs = nodes.filter((n) => n.y === r.y).map((n) => n.x);
    const mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return { ...r, labelRight: mean < MAP.width / 2 };
  });

  return { rows: rowsOut, nodes, edges, height, connectionsOf };
}
