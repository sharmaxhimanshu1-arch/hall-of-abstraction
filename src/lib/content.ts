import { getCollection, type CollectionEntry } from 'astro:content';

export type Thinker = CollectionEntry<'thinkers'>;
export type Ideology = CollectionEntry<'ideologies'>;

export const sortKey = (t: Thinker) =>
  (t.data.sortName ?? t.data.name.split(' ').at(-1) ?? t.data.name).toLowerCase();

let cache: Promise<{ thinkers: Thinker[]; ideologies: Ideology[] }> | undefined;

/**
 * Loads both collections, sorted, and checks that every cross-reference
 * points at a real entry. Astro's `reference()` only checks the shape of an
 * id, so a typo like `primary: stoicsm` would otherwise render a broken link.
 * Throwing here fails the build instead.
 */
export function loadHall() {
  // Re-read on every call in dev so content edits show up without a restart.
  if (import.meta.env.DEV) cache = undefined;
  cache ??= (async () => {
    const ideologies = (await getCollection('ideologies')).sort(
      (a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name),
    );
    const thinkers = (await getCollection('thinkers')).sort((a, b) =>
      sortKey(a).localeCompare(sortKey(b)),
    );

    const ideologyIds = new Set(ideologies.map((i) => i.id));
    const thinkerIds = new Set(thinkers.map((t) => t.id));
    const errors: string[] = [];

    for (const t of thinkers) {
      const where = `thinkers/${t.id}.md`;
      if (!ideologyIds.has(t.data.primary.id)) {
        errors.push(`${where}: unknown primary ideology "${t.data.primary.id}"`);
      }
      for (const tag of t.data.tags) {
        if (!ideologyIds.has(tag.id)) errors.push(`${where}: unknown tag "${tag.id}"`);
        if (tag.id === t.data.primary.id) {
          errors.push(`${where}: tag "${tag.id}" duplicates the primary ideology`);
        }
      }
      for (const ref of t.data.influencedBy) {
        if (!thinkerIds.has(ref.id)) errors.push(`${where}: unknown influencedBy "${ref.id}"`);
        if (ref.id === t.id) errors.push(`${where}: lists itself in influencedBy`);
      }
      if (t.data.died < t.data.born) errors.push(`${where}: died before born`);
    }

    if (errors.length) {
      throw new Error(`Content reference errors:\n  - ${errors.join('\n  - ')}`);
    }
    return { thinkers, ideologies };
  })();
  return cache;
}

export async function getIdeologies() {
  return (await loadHall()).ideologies;
}

export async function getThinkers() {
  return (await loadHall()).thinkers;
}

/** Thinkers whose primary ideology is `ideologyId`, in chronological order. */
export async function getCoreThinkers(ideologyId: string) {
  return (await getThinkers())
    .filter((t) => t.data.primary.id === ideologyId)
    .sort((a, b) => a.data.born - b.data.born);
}

/** Thinkers tagged with (but not primarily listed under) `ideologyId`. */
export async function getAssociatedThinkers(ideologyId: string) {
  return (await getThinkers())
    .filter((t) => t.data.tags.some((tag) => tag.id === ideologyId))
    .sort((a, b) => a.data.born - b.data.born);
}

export async function getIdeologyMap() {
  return new Map((await getIdeologies()).map((i) => [i.id, i]));
}

/** Resolves a thinker's influence links in both directions. */
export async function getConnections(thinker: Thinker) {
  const all = await getThinkers();
  const byId = new Map(all.map((t) => [t.id, t]));
  const influencedBy = thinker.data.influencedBy
    .map((ref) => byId.get(ref.id)!)
    .sort((a, b) => a.data.born - b.data.born);
  const influenced = all
    .filter((t) => t.data.influencedBy.some((ref) => ref.id === thinker.id))
    .sort((a, b) => a.data.born - b.data.born);
  return { influencedBy, influenced };
}
