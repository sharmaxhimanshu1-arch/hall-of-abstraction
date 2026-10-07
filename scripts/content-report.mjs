// Reports word count and section coverage for each thinker profile.
// Usage: npm run content-report   (add --strict to fail on short or incomplete pages)
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = new URL('../src/content/thinkers/', import.meta.url).pathname;
const MIN_WORDS = 5000;
const QUIZ = 5;
const SECTIONS = [
  'Start here',
  'The world',
  'The life',
  'The big ideas',
  'In conversation',
  'See it around you',
  'Use it',
  'Where',
  'The shift',
  'Quick recap',
];

const strict = process.argv.includes('--strict');
let failures = 0;

for (const name of (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort()) {
  const text = await readFile(join(DIR, name), 'utf8');
  const body = text.split(/^---$/m).slice(2).join('---');
  const words = body.split(/\s+/).filter(Boolean).length;
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const missing = SECTIONS.filter((s) => !headings.some((h) => h.startsWith(s)));
  const frontmatter = text.split(/^---$/m)[1] ?? '';
  const quiz = (frontmatter.match(/^\s+- q: /gm) ?? []).length;
  if (quiz < QUIZ) missing.push(`quiz (${quiz}/${QUIZ})`);
  const ok = words >= MIN_WORDS && missing.length === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? '✓' : '·'} ${name.padEnd(26)} ${String(words).padStart(6)} words` +
      (missing.length ? `   missing: ${missing.join(', ')}` : ''),
  );
}

console.log(`\n${failures} profile(s) still short of ${MIN_WORDS} words, the ten sections or a ${QUIZ}-question quiz.`);
if (strict && failures) process.exit(1);
