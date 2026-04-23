// Rename Figma-default "Slide 16_9 - N.png" files to sequential 01.png, 02.png,
// 03.png ... per project. Projects with a known canonical slide order (e.g.
// teeth-defender whose Figma numbering doesn't match display order) get an
// explicit mapping; everything else uses natural numeric sort on the Figma
// index. Run once after dropping all PNGs in.
//
// Usage: node scripts/rename-slides.mjs

import { readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

// For projects where Figma's numeric order doesn't match the presentation
// order, list the Figma names in display order. Anything not listed here
// falls back to natural numeric sort.
const EXPLICIT_ORDER = {
  'public/projects/teeth-defender/slides': [
    'Slide 16_9 - 1.png',
    'Slide 16_9 - 2.png',
    'Slide 16_9 - 6.png',
    'Slide 16_9 - 7.png',
    'Slide 16_9 - 8.png',
    'Slide 16_9 - 4.png',
    'Slide 16_9 - 5.png',
    'Slide 16_9 - 9.png',
  ],
};

const ROOTS = ['public/projects', 'public/work'];

function naturalSort(a, b) {
  // Extract the trailing number / token from "Slide 16_9 - <rest>.png"
  const keyA = a.replace(/\.png$/i, '').split(' - ').slice(1).join(' - ');
  const keyB = b.replace(/\.png$/i, '').split(' - ').slice(1).join(' - ');
  const nA = parseInt(keyA, 10);
  const nB = parseInt(keyB, 10);
  // Both numeric → numeric compare; else alpha
  if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
  if (!isNaN(nA)) return -1;
  if (!isNaN(nB)) return 1;
  return keyA.localeCompare(keyB);
}

async function renameOne(dir) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.png') && f.startsWith('Slide'));
  } catch { return; }
  if (files.length === 0) return;

  const explicit = EXPLICIT_ORDER[dir];
  const ordered = explicit ?? [...files].sort(naturalSort);

  console.log(`\n${dir}:`);
  // Two-phase rename to avoid collisions (tmp prefix then final).
  const tmpMap = [];
  for (let i = 0; i < ordered.length; i++) {
    const src = join(dir, ordered[i]);
    const tmp = join(dir, `.tmp_${i + 1}.png`);
    await rename(src, tmp);
    tmpMap.push({ tmp, final: join(dir, `${String(i + 1).padStart(2, '0')}.png`), original: ordered[i] });
  }
  for (const { tmp, final, original } of tmpMap) {
    await rename(tmp, final);
    console.log(`  ${original.padEnd(32)} → ${final.split('/').pop()}`);
  }
}

for (const root of ROOTS) {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch { continue; }
  for (const e of entries) {
    if (e.isDirectory()) {
      await renameOne(join(root, e.name, 'slides'));
    }
  }
}
console.log('\nDone.');
