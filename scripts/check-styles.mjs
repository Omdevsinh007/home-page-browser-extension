// Fails when component CSS, templates or inline .ts templates use raw colour values,
// Tailwind palette colours (white/black/red/...), or pixel font sizes instead of tokens
// from src/styles/tokens.css. Mark an intentional exception with /* allow-color */.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const RULES = [
  { name: 'raw colour', re: /rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/g },
  {
    name: 'palette class',
    re: /(?<![\w-])(?:[\w/-]+:)*!?(?:text|bg|border|ring|outline|fill|stroke|placeholder|divide|from|via|to)-(?:white|black|red|green|amber|yellow|blue|gray|slate|zinc|neutral|stone)(?:-\d+)?(?:\/\d+)?(?![\w-])/g,
  },
  { name: 'pixel font size', re: /(?<![\w-])(?:[\w/-]+:)*!?text-\[\d+px\]/g },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(css|html)$/.test(name) || (/\.ts$/.test(name) && !/\.spec\.ts$/.test(name))) yield path;
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
      const clean = stripVarFallbacks(line);
      for (const { name, re } of RULES) {
        const hits = clean.match(re);
        if (hits) findings.push(`${relative(process.cwd(), file)}:${i + 1}: ${name}: ${hits.join(', ')}`);
      }
    });
}

if (findings.length) {
  console.error(`check:styles found ${findings.length} problem(s):\n${findings.join('\n')}`);
  process.exit(1);
}
console.log('check:styles: no raw colours, palette classes or pixel font sizes');
