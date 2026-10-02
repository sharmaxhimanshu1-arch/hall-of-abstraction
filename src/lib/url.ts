/**
 * Builds an internal link that respects the configured `base` path
 * (the site is served from /hall-of-abstraction/ on GitHub Pages).
 *
 *   url('/')                 -> /hall-of-abstraction/
 *   url('/thinkers/plato/')  -> /hall-of-abstraction/thinkers/plato/
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

export const thinkerUrl = (id: string) => url(`/thinkers/${id}/`);
export const ideologyUrl = (id: string) => url(`/ideologies/${id}/`);
