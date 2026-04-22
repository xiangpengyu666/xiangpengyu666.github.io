import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'public/projects';
const files = await readdir(dir);
const targets = files.filter(f => f.endsWith('.png'));

for (const f of targets) {
  const src = join(dir, f);
  const out = src.replace(/\.png$/, '.webp');
  const before = (await stat(src)).size;
  await sharp(src).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  const after = (await stat(out)).size;
  console.log(`${f.padEnd(28)} ${(before / 1024).toFixed(0).padStart(6)} KB → ${(after / 1024).toFixed(0).padStart(5)} KB`);
}
