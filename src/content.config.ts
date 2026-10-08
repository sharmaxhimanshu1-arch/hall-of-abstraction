import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const ERAS = ['Ancient', 'Medieval', 'Early Modern', 'Modern', 'Contemporary'] as const;

/** Relationship of a thinker to another, from the first thinker's point of view. */
/** How far a profile has been checked; see the `status` field below. */
export const REVIEW_STATUSES = ['draft', 'fact-checked', 'reviewed'] as const;

export const STANCES = ['learned-from', 'agreed', 'challenged', 'built-on-by', 'challenged-by'] as const;

/** A school of thought. File name (e.g. `stoicism.md`) is the id / URL slug. */
const ideologies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ideologies' }),
  schema: z.object({
    name: z.string(),
    /** One-line description used on cards and in meta tags. */
    summary: z.string(),
    /** Accent colour for chips and cards, as a hex value. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    /** Display order on index pages (lower first). */
    order: z.number().int(),
  }),
});

/** A single thinker. File name (e.g. `marcus-aurelius.md`) is the id / URL slug. */
const thinkers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/thinkers' }),
  schema: z.object({
    name: z.string(),
    /** Overrides alphabetical sorting; defaults to the last word of `name`. */
    sortName: z.string().optional(),
    /** One-line hook used on cards and in meta tags. */
    summary: z.string(),

    /** Years as integers; negative numbers are BCE. */
    born: z.number().int(),
    died: z.number().int(),
    bornCirca: z.boolean().default(false),
    diedCirca: z.boolean().default(false),
    /** Caveat shown next to the dates, e.g. "traditional dates". */
    datesNote: z.string().optional(),

    region: z.string(),
    era: z.enum(ERAS),

    /** The ideology this thinker is listed under. */
    primary: reference('ideologies'),
    /** Other ideologies they are closely associated with. */
    tags: z.array(reference('ideologies')).default([]),

    keyWorks: z
      .array(z.object({ title: z.string(), year: z.string().optional() }))
      .default([]),
    quotes: z.array(z.object({ text: z.string(), source: z.string().optional() })).default([]),

    /**
     * Thinkers in the Hall who shaped this one. The reverse ("influenced")
     * list is derived automatically, so each link only needs recording once.
     */
    influencedBy: z.array(reference('thinkers')).default([]),

    /**
     * How this thinker relates to others in the Hall: who they learned from,
     * argued with, or were answered by. Shown in the sidebar with the note.
     */
    conversations: z
      .array(
        z.object({
          thinker: reference('thinkers'),
          stance: z.enum(STANCES),
          note: z.string(),
        }),
      )
      .default([]),

    /**
     * End-of-lesson check: multiple-choice questions, each with the index of
     * the correct option and a short explanation shown after answering.
     */
    quiz: z
      .array(
        z
          .object({
            q: z.string(),
            options: z.array(z.string()).min(2).max(5),
            answer: z.number().int().min(0),
            why: z.string(),
          })
          .refine((item) => item.answer < item.options.length, {
            message: 'quiz answer index is out of range',
          }),
      )
      .default([]),

    /** References the profile was drafted from — used for fact-checking. */
    sources: z.array(z.object({ title: z.string(), url: z.url() })).min(1),
    /**
     * Review stage: `draft` when first written, `fact-checked` once checked
     * against the sources with AI assistance, `reviewed` only after a human
     * editor has read and approved the page.
     */
    status: z.enum(REVIEW_STATUSES).default('draft'),
    /** Date of the fact-check (YYYY-MM-DD); required once past draft. */
    checked: z.coerce.date().optional(),
  }),
});

export const collections = { ideologies, thinkers };
