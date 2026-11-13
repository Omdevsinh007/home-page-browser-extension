// Fails when component CSS or templates use raw colour values instead of tokens
// from src/styles/tokens.css. Mark an intentional exception with /* allow-color */.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const COLOR = /rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(css|html)$/.test(name)) yield path;
  }
}

/** Removes var(--x, fallback) fallbacks so a token with a default is not flagged. */
const stripVarFallbacks = (line) => line.replace(/var\(--[\w-]+,[^)]*\)/g, '');

const findings = [];
for (const file of walk(ROOT)) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.includes('allow-color')) return;
      const hits = stripVarFallbacks(line).match(COLOR);
      if (hits) findings.push(`${relative(process.cwd(), file)}:${i + 1}: ${hits.join(', ')}`);
    });
}

if (findings.length) {
  console.error(`check:styles found ${findings.length} raw colour value(s):\n${findings.join('\n')}`);
  process.exit(1);
}
console.log('check:styles: no raw colour values');
