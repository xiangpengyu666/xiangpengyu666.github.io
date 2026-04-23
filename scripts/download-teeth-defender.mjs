// One-shot download + WebP compression of Teeth Defender key assets from
// Figma MCP. URLs expire 7 days after get_design_context was called, so run
// this soon after fetching the context. Safe to re-run — skips existing files.
//
// Usage: node scripts/download-teeth-defender.mjs

import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'public/projects/teeth-defender';

const ASSETS = [
  // Slide 1 — Cover
  { file: '01-cover.webp',             url: 'https://www.figma.com/api/mcp/asset/61ae8044-c4f5-40aa-a793-f34706f159c0', width: 1200 },

  // Slide 2 — Persona + Insights
  { file: '02-persona.webp',           url: 'https://www.figma.com/api/mcp/asset/23034050-b268-4ca5-a772-253bebf97d18', width: 600 },
  { file: '02-icon-fun.webp',          url: 'https://www.figma.com/api/mcp/asset/00bd4b9f-af86-4dd7-b2f6-3c4890a8295a', width: 120 },
  { file: '02-icon-reminder.webp',     url: 'https://www.figma.com/api/mcp/asset/def0a7a1-5415-48b2-9c84-bc4bc58aba06', width: 120 },
  { file: '02-icon-guidance.webp',     url: 'https://www.figma.com/api/mcp/asset/b26d069e-b4e8-4348-9778-697e80a688c5', width: 120 },
  { file: '02-icon-longterm.webp',     url: 'https://www.figma.com/api/mcp/asset/51831746-d13c-47b3-bbf6-54b8c595c373', width: 120 },

  // Slide 3 — Gamification
  { file: '03-map.webp',               url: 'https://www.figma.com/api/mcp/asset/954268cc-a91d-4c22-a689-dc83d15e4259', width: 1200 },
  { file: '03-game-brush.webp',        url: 'https://www.figma.com/api/mcp/asset/8b9a3646-42b9-48c5-a805-6240460f9156', width: 400 },
  { file: '03-game-shop.webp',         url: 'https://www.figma.com/api/mcp/asset/af1cea06-163f-425b-8541-08ac92ed6551', width: 400 },
  { file: '03-game-fight.webp',        url: 'https://www.figma.com/api/mcp/asset/b7a064eb-29d9-41af-a28a-1795d960adbe', width: 400 },
  { file: '03-pet-1.webp',             url: 'https://www.figma.com/api/mcp/asset/b6364c94-08c0-41a0-a6e0-20f2222d7c8e', width: 240 },
  { file: '03-pet-2.webp',             url: 'https://www.figma.com/api/mcp/asset/f46a0578-acae-46f7-ad14-8c4ff5766d39', width: 240 },
  { file: '03-pet-3.webp',             url: 'https://www.figma.com/api/mcp/asset/48f0c4a9-cde1-4ac4-8aae-390d34cc3264', width: 240 },
  { file: '03-pet-4.webp',             url: 'https://www.figma.com/api/mcp/asset/c94e4cee-ce60-467b-9f2a-51b9024d2a39', width: 240 },
  { file: '03-char-1.webp',            url: 'https://www.figma.com/api/mcp/asset/b9395b3e-a0a4-4dae-ac04-d3666687e278', width: 240 },
  { file: '03-char-2.webp',            url: 'https://www.figma.com/api/mcp/asset/a7c87372-bd96-4cc5-ac3d-ae5f9711faaf', width: 240 },
  { file: '03-char-3.webp',            url: 'https://www.figma.com/api/mcp/asset/8b3864ca-434d-4d36-9929-af7a8783a321', width: 240 },
  { file: '03-sword.webp',             url: 'https://www.figma.com/api/mcp/asset/5db1aecd-9813-4f89-9878-0c66f4ba1d6a', width: 120 },

  // Slide 4 — Toothbrush Product
  { file: '04-exploded.webp',          url: 'https://www.figma.com/api/mcp/asset/7918faa0-fc50-4a26-afb1-c79c63250fba', width: 1200 },
  { file: '04-product.webp',           url: 'https://www.figma.com/api/mcp/asset/f3283d3f-0bf6-4dd0-9fa4-e3f5e98bcdf4', width: 400 },

  // Slide 5 — Using Method
  { file: '05-joystick-bg.webp',       url: 'https://www.figma.com/api/mcp/asset/2523027c-d14a-4019-be5d-24448a26a6cd', width: 800 },
  { file: '05-joystick-press.webp',    url: 'https://www.figma.com/api/mcp/asset/71fea6e6-ac8a-47d6-a6ce-4837b0db856a', width: 600 },
  { file: '05-swing.webp',             url: 'https://www.figma.com/api/mcp/asset/c174d4a9-877b-4a3f-be89-1978b2e93937', width: 500 },
  { file: '05-button.webp',            url: 'https://www.figma.com/api/mcp/asset/b6be6315-ddfc-4a53-9fa6-81a725685beb', width: 500 },
  { file: '05-hand.webp',              url: 'https://www.figma.com/api/mcp/asset/04f01726-75ef-4f2d-a9fd-fab51624cda3', width: 500 },

  // Slide 6 — Game Chapter 01
  { file: '06-01.webp',                url: 'https://www.figma.com/api/mcp/asset/c99a1495-1877-43ef-9fbd-983e4c27a378', width: 600 },
  { file: '06-02.webp',                url: 'https://www.figma.com/api/mcp/asset/f463002f-d72f-4bd9-a3a0-dc17aab92da4', width: 600 },
  { file: '06-03.webp',                url: 'https://www.figma.com/api/mcp/asset/d64c1eb4-5017-4e63-9c44-33fc45821d4a', width: 600 },
  { file: '06-04.webp',                url: 'https://www.figma.com/api/mcp/asset/85d6ea30-3315-4d11-9ae6-bc2732ae85d4', width: 600 },
  { file: '06-05.webp',                url: 'https://www.figma.com/api/mcp/asset/9b8b4422-1707-4ff3-a0e6-673f8c13e916', width: 600 },
  { file: '06-06.webp',                url: 'https://www.figma.com/api/mcp/asset/0d97d07e-e4ec-4652-acaf-43a8ad5384ba', width: 600 },

  // Slide 7 — Game Chapter 02
  { file: '07-01.webp',                url: 'https://www.figma.com/api/mcp/asset/9361cf70-2768-4e2b-bf66-379b1a406cd0', width: 600 },
  { file: '07-02.webp',                url: 'https://www.figma.com/api/mcp/asset/816df3c6-0d93-4270-8413-4e63df8cf4cc', width: 600 },
  { file: '07-03.webp',                url: 'https://www.figma.com/api/mcp/asset/971caa70-9bc1-4ba5-bc66-4202092d6395', width: 600 },
  { file: '07-04.webp',                url: 'https://www.figma.com/api/mcp/asset/5342ff7f-8ced-4acd-9da7-fb84267ca9d7', width: 600 },
  { file: '07-05.webp',                url: 'https://www.figma.com/api/mcp/asset/9d085477-98f3-4a7b-a0a9-f5ee6e50b066', width: 600 },
  { file: '07-06.webp',                url: 'https://www.figma.com/api/mcp/asset/0cd51306-7a9a-4ea6-9fdb-776adbc6d2bf', width: 600 },
  { file: '07-info-icon.webp',         url: 'https://www.figma.com/api/mcp/asset/b74b6d06-161f-4c9b-aad0-42ade5846460', width: 120 },

  // Slide 8 — User Scenario
  { file: '08-01.webp',                url: 'https://www.figma.com/api/mcp/asset/99aedcc0-dbfb-406e-8ad3-632e15a3e23f', width: 600 },
  { file: '08-02.webp',                url: 'https://www.figma.com/api/mcp/asset/86813dce-4554-40e0-9cb7-a9055a9abb81', width: 600 },
  { file: '08-03.webp',                url: 'https://www.figma.com/api/mcp/asset/7b4c1be1-de23-4baf-8352-532b7d0e6b5a', width: 600 },
  { file: '08-04.webp',                url: 'https://www.figma.com/api/mcp/asset/9ca2409b-764c-4bdf-8cf2-983611502a20', width: 600 },
];

await mkdir(OUT_DIR, { recursive: true });

let done = 0;
let skipped = 0;
let failed = 0;

await Promise.all(ASSETS.map(async (asset) => {
  const out = join(OUT_DIR, asset.file);
  try { await stat(out); skipped++; return; } catch { /* fall through */ }
  try {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf).resize({ width: asset.width, withoutEnlargement: true });
    await img.webp({ quality: 82 }).toFile(out);
    done++;
    console.log(`✓ ${asset.file}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${asset.file} — ${err.message}`);
  }
}));

console.log(`\n${done} downloaded, ${skipped} skipped (already present), ${failed} failed`);
