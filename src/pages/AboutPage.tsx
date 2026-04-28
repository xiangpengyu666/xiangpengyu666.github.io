import { useEffect, useRef, useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import SiteHeader from '../components/SiteHeader';
import SpriteAnimator, { SPRITES, type SpriteConfig } from '../components/SpriteAnimator';
import useUiScale from '../hooks/useUiScale';
import './AboutPage.css';

const PORTRAIT = `${import.meta.env.BASE_URL}about/portrait.webp`;
const PLATFORM = `${import.meta.env.BASE_URL}sprites/platform.webp`;
const TRAIN_IMG = `${import.meta.env.BASE_URL}sprites/Final_train.png`;
const DOOR_IMG = `${import.meta.env.BASE_URL}sprites/door_panel_v3.png`;

type Phase =
  | 'train-entering'    // train slides in from left (carrying robot)
  | 'train-stopped'     // pause after arrival
  | 'doors-opening'     // doors slide open, robot appears at door
  | 'robot-exiting'     // robot mini-walks 40px right + steps down
  | 'walking-to-center' // robot auto-walks to viewport center
  | 'boarding-turn'     // robot plays board sprite (no Y), freezes on last frame
  | 'frozen'            // robot locked, train leaves + content reveals (parallel)
  ;

type RobotAnim = 'idle' | 'runRight' | 'boardTurn';

const ROBOT_SIZE = 130;
const PLATFORM_Y = 95;        // % from top — feet on yellow strip
const TRAIN_SCALE = 1.25;     // matches --train-scale in CSS
const TRAIN_WIDTH_VW = 95 * TRAIN_SCALE;
const CENTER_X = 50;          // viewport % — auto-walk target
const AUTO_SPEED = 0.125;     // % per rAF frame (halved again)

// boardTrain sprite stripped of frameYRamp + truncated to pre-lift frames.
// frameYRamp.startFrame is 12 in the original — that's where the lift starts,
// so frames 0–11 are the turn-only portion. Freezing on frame 11 leaves the
// robot back-facing (toward the train, away from the viewer).
const BOARD_FLAT_SPRITE: SpriteConfig = {
  ...SPRITES.boardTrain,
  totalFrames: 12,
  frameYRamp: undefined,
};

interface TimelineEntry {
  place: string;
  meta: string;
  label: string;
  desc: ReactNode;
}

const TIMELINE: TimelineEntry[] = [
  {
    place: 'XJTLU',
    meta: 'Suzhou city, China\n2020 - 2022',
    label: 'Design',
    desc: (
      <>
        I chose industrial design as my major because <strong>I loved things I could hold.</strong>
        <br /><br />
        In those first two years at Xi'an Jiaotong-Liverpool University, my understanding shifted from <strong>"making something fun"</strong> to <strong>"designing for real needs"</strong> — a small but foundational change.
      </>
    ),
  },
  {
    place: 'University of Liverpool',
    meta: 'Liverpool, UK\n2022 - 2024',
    label: 'Engineering',
    desc: (
      <>
        During my time in Liverpool, I realized that a product isn't a crafted object — it's <strong>a system of tradeoffs, built to scale.</strong>
        <br /><br />
        Engineering taught me the constraints that shape what design ideas can actually become, and that understanding made me a sharper designer.
      </>
    ),
  },
  {
    place: 'Ulanzi',
    meta: 'Shenzhen city, China\n2025',
    label: 'Industry',
    desc: (
      <>
        Industry showed me how the real world designs: <strong>fast, data-driven, incremental.</strong>
        <br /><br />
        I respected the logic, but I thought design and engineering could do more. I left to build the <strong>technical depth</strong> that breakthrough my <strong>innovation demands.</strong>
      </>
    ),
  },
  {
    place: 'University of Washington',
    meta: 'Seattle, USA\n2025 - 2027',
    label: 'Robotics & AI',
    desc: (
      <>
        In an era where technology is no longer the bottleneck because of AI, the greatest leverage belongs to those who can imagine what to build.
        <br /><br />
        I came to UW to close the gap between creative vision and technical execution. If I had to define myself now: <strong>a creative engineer.</strong>
      </>
    ),
  },
];

/** Door center as viewport % — train inset 83.5% lands door at this position. */
const doorCenter = (trainX: number) => trainX + 0.835 * TRAIN_WIDTH_VW;

/** Compute reveal-delay (ms) from element's figma-X. Left first, right last.
   Stagger window stretched from 1400 → 2400 so the full L→R sequence takes
   ~1s longer end-to-end. */
const revealDelayMs = (figmaX: number, max = 2400) =>
  Math.round((figmaX / 2559) * max);

export default function AboutPage() {
  const uiScale = useUiScale();

  const [phase, setPhase] = useState<Phase>('train-entering');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  const [robotX, setRobotX] = useState(0);            // viewport %
  const [robotDxPx, setRobotDxPx] = useState(0);
  const [robotDyPx, setRobotDyPx] = useState(0);
  const [trainX, setTrainX] = useState(-TRAIN_WIDTH_VW);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [robotVisible, setRobotVisible] = useState(false);
  // Flips to true after the train fully exits viewport right — gates the
  // splash title so the train doesn't slide past it.
  const [trainGone, setTrainGone] = useState(false);
  // Splash title sequence (mirrors ProjectsPage's welcome-title fade in/hold/out).
  // 'hidden' → 'in' (fade in 0.45s) → 'out' (after 0.9s hold, fade out 0.45s) →
  // 'done' (kicks off the L→R content reveal).
  const [titlePhase, setTitlePhase] = useState<'hidden' | 'in' | 'out' | 'done'>('hidden');

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  // Splash title sequence — kicks off the moment the robot freezes (parallel
  // with doors closing + train leaving).
  useEffect(() => {
    if (phase !== 'frozen') return;
    const FADE_IN = 450;
    const HOLD = 1900;   // +1s longer dwell on screen
    const FADE_OUT = 450;
    const PRE_DELAY = 200;
    const t1 = setTimeout(() => setTitlePhase('in'), PRE_DELAY);
    const t2 = setTimeout(() => setTitlePhase('out'), PRE_DELAY + FADE_IN + HOLD);
    const t3 = setTimeout(() => setTitlePhase('done'), PRE_DELAY + FADE_IN + HOLD + FADE_OUT);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // After the L→R content reveal finishes, drop the per-element delay so
  // user-triggered toggles (click label) take effect instantly.
  const [revealDone, setRevealDone] = useState(false);
  useEffect(() => {
    if (!(titlePhase === 'done' && trainGone)) return;
    const t = setTimeout(() => setRevealDone(true), 3600);
    return () => clearTimeout(t);
  }, [titlePhase, trainGone]);
  const toggleExpand = useCallback((idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const robotXRef = useRef(robotX);
  useEffect(() => { robotXRef.current = robotX; }, [robotX]);
  const trainAnimRef = useRef<number>(0);
  const walkAnimRef = useRef<number>(0);

  // ═══ Phase 1: Train slides in from left ═══
  useEffect(() => {
    if (phase !== 'train-entering') return;
    const targetX = -77;
    let currentX = -TRAIN_WIDTH_VW;
    const animate = () => {
      const diff = targetX - currentX;
      if (Math.abs(diff) < 0.3) {
        currentX = targetX;
        setTrainX(targetX);
        setPhase('train-stopped');
        setTimeout(() => setPhase('doors-opening'), 600);
        return;
      }
      currentX += diff * 0.04;
      setTrainX(currentX);
      trainAnimRef.current = requestAnimationFrame(animate);
    };
    trainAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(trainAnimRef.current);
  }, [phase]);

  // ═══ Phase 2: Robot appears at door (raised so it stands on train floor),
  //              doors open, pause, then disembark.
  useEffect(() => {
    if (phase !== 'doors-opening') return;
    setRobotX(doorCenter(trainX));
    setRobotDxPx(0);
    setRobotDyPx(-31 * uiScale);
    setRobotAnim('idle');
    setRobotVisible(true);
    setDoorsOpen(true);
    const t = setTimeout(() => setPhase('robot-exiting'), 700 + 500);
    return () => clearTimeout(t);
  }, [phase, trainX, uiScale]);

  // ═══ Phase 3: Robot mini-walks 40px right + steps down to platform ═══
  useEffect(() => {
    if (phase !== 'robot-exiting') return;
    setRobotAnim('runRight');
    const duration = 750;
    const t0 = performance.now();
    const startDy = -31 * uiScale;
    const targetDx = 40 * uiScale;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 2);
      setRobotDxPx(targetDx * eased);
      setRobotDyPx(startDy + (0 - startDy) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        // Bake px offset into robotX (vw % of viewport)
        const dxPercent = (targetDx / window.innerWidth) * 100;
        setRobotX(prev => {
          const next = prev + dxPercent;
          robotXRef.current = next;
          return next;
        });
        setRobotDxPx(0);
        setRobotDyPx(0);
        setPhase('walking-to-center');
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, uiScale]);

  // ═══ Phase 4: Auto-walk to viewport center (50%) ═══
  useEffect(() => {
    if (phase !== 'walking-to-center') return;
    setRobotAnim('runRight');
    const animate = () => {
      const cur = robotXRef.current;
      const dist = CENTER_X - cur;
      if (Math.abs(dist) < AUTO_SPEED) {
        setRobotX(CENTER_X);
        robotXRef.current = CENTER_X;
        setPhase('boarding-turn');
        return;
      }
      const next = cur + (dist > 0 ? AUTO_SPEED : -AUTO_SPEED);
      setRobotX(next);
      robotXRef.current = next;
      walkAnimRef.current = requestAnimationFrame(animate);
    };
    walkAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(walkAnimRef.current);
  }, [phase]);

  // ═══ Phase 5: Play flat board sprite, freeze on last frame ═══
  useEffect(() => {
    if (phase !== 'boarding-turn') return;
    setRobotAnim('boardTurn');
  }, [phase]);

  const onBoardComplete = useCallback(() => {
    // Sprite holds last frame automatically (loop:false). Move on.
    setPhase('frozen');
  }, []);

  // ═══ Phase 6: Doors close, train slides off-screen right ═══
  useEffect(() => {
    if (phase !== 'frozen') return;
    setDoorsOpen(false);
    const departTimer = setTimeout(() => {
      const SPEED = 70; // %/s
      let lastT = 0;
      let currentX = -77;
      const animate = (t: number) => {
        if (lastT === 0) lastT = t;
        const dt = (t - lastT) / 1000;
        lastT = t;
        currentX += SPEED * dt;
        if (currentX >= 100) {
          setTrainX(100);
          setTrainGone(true); // train fully off-screen — kick off content reveal
          return;
        }
        setTrainX(currentX);
        trainAnimRef.current = requestAnimationFrame(animate);
      };
      trainAnimRef.current = requestAnimationFrame(animate);
    }, 700); // wait for doors to close
    return () => clearTimeout(departTimer);
  }, [phase]);

  // ═══ Sprite picker ═══
  const getCurrentSprite = (): { sprite: SpriteConfig; flip: boolean } => {
    switch (robotAnim) {
      case 'idle': return { sprite: SPRITES.idle, flip: false };
      case 'runRight': return { sprite: SPRITES.runRight, flip: false };
      case 'boardTurn': return { sprite: BOARD_FLAT_SPRITE, flip: false };
    }
  };
  const { sprite: currentSprite, flip } = getCurrentSprite();
  const spriteScale = currentSprite.scale ?? 1;
  const xOffset = currentSprite.xOffset ?? 0;
  const yOffset = currentSprite.yOffset ?? 0;
  const aspectRatio = currentSprite.frameWidth / currentSprite.frameHeight;
  const renderHeight = ROBOT_SIZE * uiScale * spriteScale;
  const renderWidth = renderHeight * aspectRatio;

  // Content reveals only after BOTH the splash title and train exit are done,
  // so the train can't slide past the freshly-appearing content.
  const isRevealing = titlePhase === 'done' && trainGone;
  // Each timeline column's reveal: dot/place/label, then desc + tick last.
  // Desc + tick delay = column-center reveal delay + tail offset.
  const TAIL_OFFSET_MS = 220;
  const COL_CENTERS = [1028.5, 1442.5, 1856.5, 2270.5];
  const showTrain = phase !== 'frozen' || trainX < 100;
  // Hide train chrome (door panels) once it's fully off-screen right
  const trainOffscreenRight = trainX >= 100;

  return (
    <div
      className={`about-page${isRevealing ? ' is-revealing' : ''}${revealDone ? ' reveal-done' : ''}`}
      style={{ ['--ui-scale' as string]: uiScale, ['--train-scale' as string]: TRAIN_SCALE } as CSSProperties}
    >
      <SiteHeader />

      {/* Splash title — same fade-in/hold/fade-out treatment as ProjectsPage's
          welcome banner. Plays once the train has fully exited. */}
      <div
        className="about-splash-title"
        style={{ opacity: titlePhase === 'in' ? 1 : 0, pointerEvents: 'none' }}
      >
        <h1>About me</h1>
      </div>

      {/* Figma-coord canvas. Children individually fade in left-to-right when
          .about-page has .is-revealing. */}
      <div className="figma-canvas">
        <div className="fc-card reveal" style={{ ['--rd' as string]: `${revealDelayMs(78)}ms` } as CSSProperties} />
        <img
          className="fc-portrait reveal"
          src={PORTRAIT}
          alt="Xiangpeng Yu"
          style={{ ['--rd' as string]: `${revealDelayMs(109)}ms` } as CSSProperties}
        />
        <h1
          className="fc-about-heading reveal"
          style={{ ['--rd' as string]: `${revealDelayMs(109) + 100}ms` } as CSSProperties}
        >About me</h1>
        <p
          className="fc-quote reveal"
          style={{ ['--rd' as string]: `${revealDelayMs(109) + 150}ms` } as CSSProperties}
        >"I shape ideas. I ship solutions."</p>

        <h2
          className="fc-experience-title reveal"
          style={{ ['--rd' as string]: `${revealDelayMs(840)}ms` } as CSSProperties}
        >Experience</h2>

        <div
          className="fc-tl-line reveal"
          aria-hidden
          style={{ ['--rd' as string]: `${revealDelayMs(850)}ms` } as CSSProperties}
        />

        {/* Dots — left positions: 1011/1425/1839/2253 */}
        {[1011, 1425, 1839, 2253].map((x, i) => (
          <div
            key={`dot-${i}`}
            className={`fc-dot d${i + 1} reveal`}
            aria-hidden
            style={{ ['--rd' as string]: `${revealDelayMs(x)}ms` } as CSSProperties}
          />
        ))}

        {/* Place blocks — figma center x: 1028.5, 1442.5, 1856.5, 2270.5 */}
        {TIMELINE.map((entry, i) => {
          const cx = [1028.5, 1442.5, 1856.5, 2270.5][i];
          const active = expanded.has(i);
          return (
            <div
              key={entry.place}
              className={`fc-place p${i + 1} reveal${active ? ' is-active' : ''}`}
              style={{ ['--rd' as string]: `${revealDelayMs(cx)}ms` } as CSSProperties}
            >
              <span className="place-name">{entry.place}</span>
              {entry.meta.split('\n').map((line) => (
                <span key={line} className="place-meta">{line}</span>
              ))}
            </div>
          );
        })}

        {/* Labels — clickable */}
        {TIMELINE.map((entry, i) => {
          const cx = [1029.5, 1443.5, 1856.5, 2270.5][i];
          const active = expanded.has(i);
          return (
            <button
              key={entry.label}
              type="button"
              className={`fc-label l${i + 1} reveal${active ? ' is-active' : ''}`}
              onClick={() => toggleExpand(i)}
              aria-expanded={active}
              aria-controls={`fc-desc-${i}`}
              style={{ ['--rd' as string]: `${revealDelayMs(cx) + 80}ms` } as CSSProperties}
            >
              {entry.label}
            </button>
          );
        })}

        {/* Vertical ticks — last in each column's reveal sequence */}
        {[1028, 1443, 1857, 2271].map((x, i) => (
          <div
            key={`tick-${i}`}
            className={`fc-tick t${i + 1}${expanded.has(i) ? ' is-active' : ''}`}
            aria-hidden
            style={{
              left: `calc(${x} * var(--fpx))`,
              ['--rd' as string]: `${revealDelayMs(COL_CENTERS[i]) + TAIL_OFFSET_MS}ms`,
            } as CSSProperties}
          />
        ))}

        {/* Descriptions — also last in each column's reveal sequence */}
        {TIMELINE.map((entry, i) => (
          <p
            key={`desc-${i}`}
            id={`fc-desc-${i}`}
            className={`fc-desc d${i + 1}${expanded.has(i) ? ' is-active' : ''}`}
            style={{
              ['--rd' as string]: `${revealDelayMs(COL_CENTERS[i]) + TAIL_OFFSET_MS}ms`,
            } as CSSProperties}
          >
            {entry.desc}
          </p>
        ))}
      </div>

      {/* Platform — viewport-bottom illustrated band (reused from HomePage) */}
      <img className="about-platform" src={PLATFORM} alt="" aria-hidden />

      {/* Train (during arrival → boarding-turn → leaving) */}
      {showTrain && (
        <div
          className="train-container about-train"
          style={{
            left: `${trainX}%`,
            bottom: `calc(${100 - PLATFORM_Y}% - ${5 * uiScale}px + ${45 * uiScale}px)`,
          }}
        >
          <img src={TRAIN_IMG} alt="" className="train-body" />
          {!trainOffscreenRight && (
            <div className="train-doors" style={{ zIndex: 4 }}>
              <img
                src={DOOR_IMG}
                alt=""
                className={`door-panel door-left ${doorsOpen ? 'open' : ''}`}
              />
              <img
                src={DOOR_IMG}
                alt=""
                className={`door-panel door-right ${doorsOpen ? 'open' : ''}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Robot */}
      {robotVisible && (
        <div
          className={`robot-container about-robot anim-${robotAnim}`}
          style={{
            left: `${robotX}%`,
            bottom: `calc(${100 - PLATFORM_Y}% - 2px + ${45 * uiScale}px)`,
            transform: `translateX(calc(-50% + ${xOffset * uiScale + robotDxPx}px)) translateY(${yOffset * uiScale + robotDyPx}px)`,
          }}
        >
          <div className="robot-shadow" />
          <SpriteAnimator
            sprite={currentSprite}
            width={renderWidth}
            height={renderHeight}
            flipX={flip}
            playing={true}
            onComplete={robotAnim === 'boardTurn' ? onBoardComplete : undefined}
          />
        </div>
      )}
    </div>
  );
}
