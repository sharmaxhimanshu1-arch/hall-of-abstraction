// Checks that every internal link and asset in the built site (dist/) resolves
// to a real file. Run after `npm run build`:  npm run check-links
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = '/hall-of-abstraction/';

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

async function exists(path) {
  try {
    const s = await stat(path);
    return s.isDirectory() ? exists(join(path, 'index.html')) : true;
  } catch {
    return false;
  }
}

const broken = [];
let checked = 0;

for await (const file of htmlFiles(DIST)) {
  const html = await readFile(file, 'utf8');
  for (const [, link] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
    if (!link.startsWith('/')) continue; // external or relative-to-page
    checked++;
    if (!link.startsWith(BASE)) {
      broken.push(`${relative(DIST, file)}: ${link} (missing base path)`);
      continue;
    }
    const target = join(DIST, decodeURIComponent(link.slice(BASE.length)));
    if (!(await exists(target))) broken.push(`${relative(DIST, file)}: ${link}`);
  }
}

if (broken.length) {
  console.error(`✗ ${broken.length} broken internal link(s):\n  ${broken.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${checked} internal links checked, none broken.`);
