// One-shot re-order slides per project to match Figma's visual order (Y axis
// in the 133:460 overview canvas). Maps newPosition → currentPosition, then
// two-phase renames to avoid collisions.
// Run once after the initial rename+compress pass, not idempotent.

import { rename, access } from 'node:fs/promises';
import { join } from 'node:path';

const ORDER_MAPS = {
  // new idx → current idx (1-based)
  'public/projects/echowave/slides':          [1, 3, 2, 6, 5, 7, 4],
  'public/projects/f-mouse/slides':           [11, 12, 1, 2, 3, 4, 6, 7, 5, 8, 9, 10],
  'public/projects/icegleam/slides':          [1, 2, 3, 5, 4, 6, 7],
  'public/projects/puppy-poop-loop/slides':   [1, 2, 3, 9, 4, 5, 6, 7, 8],
  'public/work/quick-release-clip/slides':    [1, 4, 2, 3],
  'public/work/camera-clamp/slides':          [1, 4, 2, 6, 3, 5],
  'public/work/sd-reader/slides':             [1, 4, 2, 3],
};

const pad = (n) => String(n).padStart(2, '0');

for (const [dir, map] of Object.entries(ORDER_MAPS)) {
  // If this is identity, skip
  const identity = map.every((v, i) => v === i + 1);
  if (identity) { console.log(`${dir}: identity, skipped`); continue; }

  console.log(`\n${dir}:`);
  // Phase 1: rename every current NN.webp to tmp_NN.webp
  for (let i = 1; i <= map.length; i++) {
    const from = join(dir, `${pad(i)}.webp`);
    const to = join(dir, `.tmp_${pad(i)}.webp`);
    try { await access(from); } catch { console.log(`  missing ${from}`); continue; }
    await rename(from, to);
  }
  // Phase 2: for each new position, move tmp_<src>.webp → <newPos>.webp
  for (let newIdx = 1; newIdx <= map.length; newIdx++) {
    const srcIdx = map[newIdx - 1];
    const from = join(dir, `.tmp_${pad(srcIdx)}.webp`);
    const to = join(dir, `${pad(newIdx)}.webp`);
    await rename(from, to);
    console.log(`  pos ${pad(newIdx)} ← was ${pad(srcIdx)}`);
  }
}

console.log('\nDone.');
