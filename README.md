# Hall of Abstraction

A reading-focused website profiling the great thinkers who shaped how we reason, govern and live, organised by the schools of thought (ideologies) they built or belong to.

Built with [Astro](https://astro.build) as a fully static site. All content lives in Markdown files, so there's no database or server. Site-wide search is provided by [Pagefind](https://pagefind.app).

## Getting started

Requires Node 22.12 or newer.

```sh
npm install
npm run dev          # dev server at http://localhost:4321/hall-of-abstraction/
npm run build        # type-check, build to dist/, then build the search index
npm run preview      # serve the production build (search works here, not in dev)
npm run check-links  # after a build: verify every internal link resolves
```

## Project structure

```
src/
  content/
    ideologies/<slug>.md   one file per school of thought
    thinkers/<slug>.md     one file per thinker
  content.config.ts        frontmatter schemas for both collections
  lib/content.ts           loads content and validates cross-references
  lib/format.ts            date formatting (negative years are BCE)
  pages/                   routes: /, /ideologies/, /thinkers/, /about/, /search/
  components/              cards, chips, quotes, influence lists
scripts/check-links.mjs    internal link checker for dist/
```

## Adding a thinker

Create `src/content/thinkers/<slug>.md`. The file name becomes the URL (`/thinkers/<slug>/`).

```yaml
---
name: Hannah Arendt
summary: One line that appears on cards and in search results.
born: 1906                  # negative numbers are BCE
died: 1975
bornCirca: false            # optional; prefixes "c."
datesNote: traditional dates # optional caveat shown next to the dates
region: Germany; United States
era: Contemporary           # Ancient | Medieval | Early Modern | Modern | Contemporary
primary: liberalism         # the ideology they are listed under (an ideology file name)
tags: [existentialism]      # other ideologies they also appear under
keyWorks:
  - title: The Origins of Totalitarianism
    year: '1951'
quotes:
  - text: The quotation, exactly as published.
    source: Work, section (translator)
influencedBy: [immanuel-kant] # thinker file names; the reverse links are generated
sources:                    # at least one; used for fact-checking
  - title: Stanford Encyclopedia of Philosophy, "Hannah Arendt"
    url: https://plato.stanford.edu/entries/arendt/
reviewed: false
---

## Life
...
## Key ideas
...
## Influence and legacy
...
```

The build fails if a required field is missing, or if `primary`, `tags` or `influencedBy` refer to an ideology or thinker that doesn't exist. Quote any YAML value that contains `: `.

To add an ideology, create `src/content/ideologies/<slug>.md` with `name`, `summary`, `color` (a hex colour dark enough for white text) and `order`.

## Editorial review

Every profile starts with `reviewed: false`, and its page tells readers it is a draft. After fact-checking a profile against its sources, set `reviewed: true`. The About page shows how many profiles have been reviewed. To list the profiles still waiting:

```sh
grep -l "reviewed: false" src/content/thinkers/*.md
```

## Deployment

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`. Other branches and pull requests run the build and link check only (`ci.yml`). To enable Pages once, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. The site will be served at `https://sharmaxhimanshu1-arch.github.io/hall-of-abstraction/`.

If the repository or account name changes, update `site` and `base` in `astro.config.mjs`.
