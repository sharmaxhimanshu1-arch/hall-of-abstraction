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
  rowHeight: 80,
  bottom: 16,
  minGap: 36,
  breakWidth: 24,
  /**
   * The time axis jumps over long empty stretches. Each segment takes a share
   * of the plot width; a zig-zag marks the jump between segments.
   */
  segments: [
    { from: -600, to: 450, share: 0.27 },
    { from: 1000, to: 1450, share: 0.15 },
    { from: 1550, to: 1950, share: 0.58 },
  ],
} as const;

const plotLeft = MAP.left;
const usable = MAP.right - plotLeft - MAP.breakWidth * (MAP.segments.length - 1);

/** Pixel span of each segment along the axis. */
const spans = (() => {
  let x = plotLeft;
  return MAP.segments.map((seg) => {
    const span = { ...seg, x1: x, x2: x + usable * seg.share };
    x = span.x2 + MAP.breakWidth;
    return span;
  });
})();

/** Maps a year (negative = BCE) onto the segmented time axis. */
export function yearToX(year: number): number {
  const span =
    spans.find((s) => year <= s.to) ??
    spans.at(-1)!;
  const t = (year - span.from) / (span.to - span.from);
  return span.x1 + Math.min(1, Math.max(0, t)) * (span.x2 - span.x1);
}

export const axisBreaks = spans.slice(1).map((s, i) => ({ x1: spans[i]!.x2, x2: s.x1 }));

export const ticks = [
  { year: -500, label: '500 BCE' },
  { year: 1, label: '1 CE' },
  { year: 1100, label: '1100' },
  { year: 1300, label: '1300' },
  { year: 1600, label: '1600' },
  { year: 1700, label: '1700' },
  { year: 1800, label: '1800' },
  { year: 1900, label: '1900' },
].map((t) => ({ ...t, x: yearToX(t.year) }));

type LabelSlot = 'below' | 'above' | 'high' | 'low';
/** Vertical offset of each label slot from the dot's centre. */
const SLOT_OFFSET: Record<LabelSlot, number> = { below: 22, above: -13, high: -29, low: 38 };

/** Labels near the edges hang inward so they are never clipped. */
const EDGE = 48;
export const labelAnchor = (x: number): 'start' | 'middle' | 'end' =>
  x > MAP.width - EDGE ? 'end' : x < EDGE ? 'start' : 'middle';
export const labelOffset = (anchor: 'start' | 'middle' | 'end') =>
  anchor === 'end' ? 9 : anchor === 'start' ? -9 : 0;

function labelExtent(x: number, label: string, anchor: 'start' | 'middle' | 'end'): [number, number] {
  const w = label.length * 7 + 6;
  const at = x + labelOffset(anchor);
  return anchor === 'middle' ? [at - w / 2, at + w / 2] : anchor === 'end' ? [at - w, at] : [at, at + w];
}

const SHORT_NAMES: Record<string, string> = {
  'siddhartha-gautama': 'Buddha',
  augustine: 'Augustine',
  'ibn-rushd': 'Ibn Rushd',
  'ibn-khaldun': 'Ibn Khaldun',
  'thomas-aquinas': 'Aquinas',
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
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
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

    // Choose a slot for each label so that labels in the same slot never
    // overlap; widths are estimated from the label length. Busy rows can use
    // a second line above or below the dot.
    const placed: Record<LabelSlot, [number, number][]> = { below: [], above: [], high: [], low: [] };
    let prevSlot: LabelSlot = 'above';
    members.forEach((m, i) => {
      const label = shortName(m.t);
      const anchor = labelAnchor(m.x);
      const extent = labelExtent(m.x, label, anchor);
      const clash = (slot: LabelSlot) =>
        placed[slot].reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, extent[1]) - Math.max(a, extent[0])), 0);
      const close = i > 0 && m.x - members[i - 1]!.x < 78;
      const first: LabelSlot = close && prevSlot === 'below' ? 'above' : 'below';
      const order: LabelSlot[] = [first, first === 'below' ? 'above' : 'below', 'high', 'low'];
      const slot = order.find((o) => clash(o) === 0) ?? order.reduce((a, b) => (clash(b) < clash(a) ? b : a));
      placed[slot].push(extent);
      prevSlot = slot;
      nodes.push({
        id: m.t.id,
        label,
        x: m.x,
        y: row.y,
        color: row.ideology.data.color,
        labelY: row.y + SLOT_OFFSET[slot],
        anchor,
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
