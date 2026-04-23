// Walk every public/{projects,work}/<slug>/slides/ directory, convert each
// *.png to *.webp at quality 88, and delete the source PNG. Idempotent —
// rerun after dropping new slides into any project's folder.
//
// Usage:
//   node scripts/compress-slides.mjs                      # all projects
//   node scripts/compress-slides.mjs projects/teeth-defender   # one project
//   node scripts/compress-slides.mjs work/quick-release-clip   # one work project
//
// Notes:
//   - Keeps existing .webp files untouched
//   - Skips a directory if it has no PNGs
//   - Preserves slide filename (just changes extension)

import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['public/projects', 'public/work'];
const QUALITY = 88;

async function listProjectSlugs() {
  const all = [];
  for (const root of ROOTS) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        // slug stored as "<root-leaf>/<dirname>" so compressOne can locate it
        all.push(`${root.split('/').pop()}/${e.name}`);
      }
    }
  }
  return all;
}

async function compressOne(slug) {
  // slug may be "projects/foo" or "work/foo" — dispatch to the right root.
  let dir;
  if (slug.startsWith('projects/') || slug.startsWith('work/')) {
    dir = join('public', slug, 'slides');
  } else {
    // Back-compat: bare name defaults to projects/
    dir = join('public/projects', slug, 'slides');
  }
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.png'));
  } catch {
    return null; // no slides folder — project not scaffolded for slides
  }
  if (files.length === 0) return { slug, converted: 0, saved: 0 };

  let converted = 0;
  let before = 0;
  let after = 0;
  for (const f of files) {
    const src = join(dir, f);
    const out = src.replace(/\.png$/i, '.webp');
    const srcSize = (await stat(src)).size;
    before += srcSize;
    await sharp(src).webp({ quality: QUALITY }).toFile(out);
    const outSize = (await stat(out)).size;
    after += outSize;
    await unlink(src);
    converted++;
    console.log(
      `  ${f.padEnd(32)} ${(srcSize / 1024).toFixed(0).padStart(6)} KB → ${(outSize / 1024).toFixed(0).padStart(5)} KB`
    );
  }
  return { slug, converted, saved: before - after, before, after };
}

const argSlug = process.argv[2];
const slugs = argSlug ? [argSlug] : await listProjectSlugs();

console.log(`Scanning ${slugs.length} project folder(s)…\n`);
const results = [];
for (const slug of slugs) {
  const r = await compressOne(slug);
  if (r === null) continue;
  if (r.converted > 0) {
    console.log(`${slug}: ${r.converted} file(s), saved ${(r.saved / 1024 / 1024).toFixed(2)} MB\n`);
  }
  results.push(r);
}

const totalConverted = results.reduce((a, r) => a + r.converted, 0);
const totalSaved = results.reduce((a, r) => a + (r.saved || 0), 0);
console.log(
  totalConverted === 0
    ? 'Nothing to do — all slides already WebP.'
    : `Done. Converted ${totalConverted} PNG(s), saved ${(totalSaved / 1024 / 1024).toFixed(2)} MB total.`
);
