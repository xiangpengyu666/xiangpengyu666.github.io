# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server
npm run build      # tsc + vite build (runs before deploy)
npm run deploy     # build + push dist/ to gh-pages branch → xiangpengyu666.github.io
npm run lint       # eslint
npm run preview    # preview production build locally
```

No test suite exists.

## Architecture

Single-page portfolio deployed as a GitHub Pages static site. Routing uses `HashRouter` (required for gh-pages compatibility — do not switch to `BrowserRouter`).

### Interactive Homepage — train station metaphor

`HomePage.tsx` drives a scripted interactive sequence via a `Phase` state machine:

```
idle-start → greeting → free-roam → train-arriving → train-stopped → doors-open → boarding → destination
```

- The robot character is positioned with `robotX` (% from left), sitting on the platform at `PLATFORM_Y = 88%`.
- Keyboard input (`←/→` or `a/d`) is captured via a ref-based `Set<string>` to avoid re-render lag; movement runs in a `requestAnimationFrame` loop.
- The train slides in via its own rAF loop (ease-out lerp); `trainX` starts at `-TRAIN_WIDTH_VW` (fully off-screen left) and stops at `-77%`, which puts the door center at ~17% of the viewport. Train width = `calc(95vw * var(--train-scale))` — `TRAIN_SCALE = 1.25` in both TS and CSS (keep in sync). The train is also nudged down by `5px * uiScale` (inline style) to sit a touch below the platform line.
- The door overlay (`.train-doors`) aligns to the rightmost (door-less) entrance in `Final_train.png`. **Double sliding doors**: two `door_panel_v3.png` panels (right one mirrored via `scaleX(-1)`) sit closed during arrival to match the closed doors painted at the train's other entrances; on `.open` they slide outward (left panel left, right panel right). After the boarding animation completes, `setDoorsOpen(false)` closes them before the destination modal appears.
- **Door positioning is pixel-tuned to `Final_train.png` (4096×808, aspect 5.07:1) — do not "clean up" without re-aligning visually**. All offsets are `vw * var(--train-scale)` so they scale *with the train* (not with `--ui-scale`, which is dampened on large screens):
  - `.train-doors { left: 80%; top: calc(24% + 1.471vw * var(--train-scale)); width: 6.3%; height: calc(49.5% + 2.153vw * var(--train-scale)); }` (overlay box on the train)
  - `.door-panel { width: 50%; object-fit: fill; position: relative; }` — `fill` lets panels stretch vertically without distorting horizontal width
  - `.door-left { left: calc(0.667vw * var(--train-scale)); }` / `.door-right` (same `left` + `scaleX(-1)`) — nudges each panel inside its half of the entrance frame
  - Open: `.door-{left,right}.open` translate ±`3.333vw * var(--train-scale)` outward
  - Why vw, not px×ui-scale? Doors must track the train (sized in vw). With linear ui-scale it worked, but once ui-scale got dampened on big screens, doors shrank slower than the train. Switching to vw pins them to the train's actual rendered size.
  - Base-unit convention: to tune by N screen pixels at 1440px viewport, convert via `N / 14.4` vw in the base value (e.g. top was nudged +6px → +0.417vw into the 1.471 figure).
- Space-to-board is gated: robot must be within 6% of `getDoorCenterPercent()` (`trainX + 0.835 * TRAIN_WIDTH_VW`, i.e. door center as % of viewport width).
- Above the station scene, `<header className="site-header">` (Xp logo + nav) and `<section className="welcome">` (intro text) are absolutely positioned overlays.
- **Boarding close: robot vanishes via z-index trick, not opacity/conditional render**:
  - During `phase === 'boarding' && !doorsOpen`, robot's inline `zIndex: 1` drops it BELOW `.train-body` (z-index: 4 in CSS), so the opaque train PNG instantly hides the entire robot.
  - In the same condition, `.train-doors` inline `zIndex: 30` lifts the door panels above robot/hint-bubble so the closing animation reads as "doors covering the robot".
  - This works because `.train-container` intentionally has NO z-index → no stacking context → its child `.train-doors`'s z-index escapes to compete with the robot's z at the page root.
  - **Don't try to "fix" this with opacity transitions or DOM removal** — earlier attempts hit a CSS rabbit hole (door PNG has transparent edges, `transform` on `.scene`/robot creates stacking contexts that trap z-index, etc.). The z=1 trick works.

### SpriteAnimator

`SpriteAnimator.tsx` renders sprite sheets onto a `<canvas>` using rAF. Key details:
- Each `SpriteConfig` in `SPRITES` declares `frameWidth/Height`, `columns`, `totalFrames`, `fps`, and `loop`.
- `flipX` is handled by `ctx.scale(-1, 1)` — used to reuse `runLeft`/`turnToLeft` assets for right-facing movement.
- Non-looping sprites call `onComplete` once and freeze on the last frame.
- All props (`sprite`, `width`, `height`, `flipX`, `onComplete`) are mirrored into refs each render so the single rAF loop never needs to restart on prop changes — only `playing` and `sprite.src` changes restart the loop.
- When a non-looping animation completes, the loop stops; it restarts when `sprite.src` changes (i.e. when the next animation is assigned).

### Responsive scaling (`src/hooks/useUiScale.ts`)

The interactive scenes are scaled by a single factor `--ui-scale` injected as a CSS variable onto `.homepage` / `.projects-page`, and also consumed directly in TSX (robot size, sprite offsets, disembark px offsets, train bottom nudge).

- Formula: `raw = innerWidth / 1440`; below baseline it's linear, above baseline dampened: `1 + (raw - 1) * 0.5`, then clamped to `[0.6, 3]`. The dampening is **intentional** — pure linear scaling looks oversized on large monitors because rem/px values grow 1:1 with the viewport while human perception is sublinear.
- **Unit rules**: `rem` and `px` MUST multiply by `var(--ui-scale)` to track viewport. `vw` / `vh` / `%` already scale linearly — do **not** multiply them again or you'll double-scale (this already bit me with `.project-card` width).
- **Train / door / project-card use vw** (fully linear with viewport), NOT `ui-scale` — they're "world" elements that should track the screen 1:1. The dampening applies to text, nav, robot, and small px nudges only.
- A second variable `--train-scale: 1.25` (mirrored as `TRAIN_SCALE` constant in both TSX files) scales just the train assembly — bump it to make the train bigger without touching everything else. `TRAIN_WIDTH_VW = 95 * TRAIN_SCALE` is used in the TSX door-center formula.

### Assets

- `src/Spritesheet/` — sprite sheet PNGs, imported directly via Vite in `SpriteAnimator.tsx` (hashed at build time)
- `public/sprites/` — train and door images only (`Final_train.png` 4096×808, `door_panel_v3.png` 290×998 with alpha), referenced by URL string in `HomePage.tsx` / `ProjectsPage.tsx` via `${import.meta.env.BASE_URL}sprites/...` (so gh-pages subpaths work). The door PNG **has transparent edges** — never assume opaque coverage. Filename casing matters — gh-pages is case-sensitive.
- `public/projects/` — 5 project covers + `to-be-continued.webp` (Figma exports, ~360 KB total after compression)
- `scripts/compress-projects.mjs` — sharp-based one-shot script to convert `public/projects/*.png` → `*.webp` (width 1200, quality 80). Run via `node scripts/compress-projects.mjs` after dropping in new PNGs from Figma.
- `jump_spritesheet.png` is defined in `SPRITES` but not used on the homepage — used on ProjectsPage for the project-jump interaction
- `public/bg.png` is **no longer referenced** — homepage background is plain white and the logo / nav / intro text are HTML

### Styling

- Homepage uses a **light theme** (plain white `#fff` background — no background image). The dark CSS station elements (wall, pillars, sign) have been removed.
- Global CSS variables in `src/styles/global.css`:
  - `--font-display: 'Instrument Serif'`, `--font-body: 'DM Sans'`, `--font-mono: 'JetBrains Mono'`, `--font-script: 'Caveat'` (used for the Xp logo) — all loaded via Google Fonts (in `index.html`)
  - `--font-puhui: 'Alibaba PuHuiTi 3.0 55 Regular'`, `--font-puhui-semibold: 'Alibaba PuHuiTi 3.0 75 SemiBold'` — loaded via cn-fontsource CDN (in `index.html`), used on ProjectsPage to match Figma typography

### Personal Projects page — `ProjectsPage.tsx` (route: `/projects`)

Continuation of the train-journey narrative: user selects "Projects" from HomePage's destination modal → HomePage's `departing` phase slides the train off-screen right → `navigate('/projects')` → ProjectsPage plays the inverse entry.

Phase state machine:

```
train-entering → train-stopped → doors-opening → robot-exiting → doors-closing
  → train-leaving → title-showing → projects-appearing → free-roam
  → jumping → project-detail
```

Flow:

1. **Train entry** — train slides in from left (`trainX: -TRAIN_WIDTH_VW → -77`, same easing as HomePage arrival), carrying the robot (robot hidden during entry — it's "inside" the train).
2. **Doors open + idle robot** — `setDoorsOpen(true)` triggers the 0.7s panel slide. Robot is placed at door center in `idle` pose, raised `31px * uiScale` (so it appears to stand on the train floor), with `.train-container` inline `zIndex: 20` lifting it above `.scene` (z 6) so closed doors hide the robot during the slide.
3. **Pause + transition** — after doors finish (700ms), train z drops back to 5 (so robot is now visibly in front), then 500ms idle pause for the standing animation.
4. **Disembark walk** — `runRight` animation, robot's px offsets lerp from `(0, -31 * uiScale)` to `(40 * uiScale, 0)` over 1.5s (steps right ~40px and down ~31px to land on the platform). On free-roam entry, `robotDxPx` is converted to vw and baked into `robotX` to avoid a visual snap.
5. **Doors close → train departs** — doors close (`.open` class removed, 0.7s transition), then train slides off-screen right at constant 45%/s.
6. **Title fade** — in parallel with the train leaving, `"Welcome to Xiangpeng's personal projects"` fades in (PuHuiTi 80px / `clamp(2.5rem, 4.2vw, 5rem)`, 0.9s transition), holds ~1.8s, fades out.
7. **Project cards appear** — 5 cards (01–05) positioned along a scene wider than viewport (`SCENE_WIDTH_VW = 300`) fade in together via `.projects-row.visible`. Plus a `.to-be-continued` overlay (robot+sign+cone composite at `xVw=265`) at scene end.
8. **Free-roam + camera follow** — robot moves with ←/→ or a/d across the scene; `cameraX` keeps the robot near viewport center by translating `.scene` (`transform: translateX(-cameraX vw)`), clamped to scene edges. The train is rendered OUTSIDE `.scene` so it stays in viewport coordinates during entry/exit. **Camera-follow useEffect is gated to non-train phases** — during the train sequence, `cameraX` is forced to 0 so the robot appears at the door (its real scene-vw position), not re-centered to mid-viewport.
9. **Jump → modal** — when robot is within 6vw of a project's `xVw` and user presses Space, play jump animation; on completion, open the project detail modal. Esc or click-outside closes it.

Key coordinates:
- Robot position (`robotX`) is in **scene vw** (0 to `SCENE_WIDTH_VW`), NOT viewport %. Same for each `PROJECTS[i].xVw`.
- Train position (`trainX`) stays in **viewport %** because the train is rendered outside `.scene`.
- Door center helper `getDoorCenterPercent() = trainX + 0.835 * 95` is in viewport % (same formula as HomePage). It's used only during the train-still-on-screen phases, when camera is still at 0, so viewport-vw ≈ scene-vw at that moment.
- Project xVw values: `30, 77.5, 125, 172.5, 220` (47.5vw apart). To Be Continued sign at `265vw`.
- Robot baseline is `bottom: calc(${100 - PLATFORM_Y}% - 3px)` (3px below platform line) — Projects-page-only fine-tune, doesn't apply to train/cards.

Card layout (matches Figma Desk-3/4):
- Each `.project-card` width 27vw (max 540px), `transform: translateX(-50%) scale(1.2)` with `transform-origin: top center`
- `.projects-row` top: `calc(25% - 120px)`
- Number 48px PuHuiTi Regular `#808080`; title 24px PuHuiTi SemiBold black; subtitle 24px PuHuiTi Regular `#808080`
- Thumbnail aspect-ratio `527 / 386`, `object-fit: cover`

### Figma integration

- Design source: `https://www.figma.com/design/p2GCd0gwGPpBWnRlsDN81M/NEW_PORTFOLIO` — three frames on Page 3 (`106:9952`): **Desk-5** (welcome title), **Desk-3** (projects row 01–04), **Desk-4** (project 05 + "To Be Continued" composite).
- The `claude.ai Figma` MCP (remote) can do `get_screenshot` and `get_metadata` with explicit nodeId/fileKey. `get_design_context` (the rich version that returns React+Tailwind reference code, asset URLs, design tokens) requires a layer to be **selected in Figma desktop** — when calling it, ask the user to select the target frame first.
- Asset URLs returned by `get_design_context` (e.g. `https://www.figma.com/api/mcp/asset/...`) expire after **7 days** — download immediately, then run `node scripts/compress-projects.mjs` to convert to WebP.

### Planned pages (stubs in destination modal)

Gallery, Blog, Contact — navigation from the destination modal still points to `/gallery`, `/blog`, `/contact` but those routes do not exist yet.
