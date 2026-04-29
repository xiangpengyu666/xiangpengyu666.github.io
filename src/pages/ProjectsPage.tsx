import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import SpriteAnimator, { SPRITES } from '../components/SpriteAnimator';
import SiteHeader from '../components/SiteHeader';
import ProjectDetailModal from '../components/ProjectDetailModal';
import TeethDefenderDetail from '../projects/teeth-defender/TeethDefenderDetail';
import FMouseDetail from '../projects/f-mouse/FMouseDetail';
import EchoWaveDetail from '../projects/echowave/EchoWaveDetail';
import IceGleamDetail from '../projects/icegleam/IceGleamDetail';
import PuppyPoopLoopDetail from '../projects/puppy-poop-loop/PuppyPoopLoopDetail';

// Map each project id to its dedicated detail component.
const DETAIL_COMPONENTS: Record<string, () => JSX.Element> = {
  '01': TeethDefenderDetail,
  '02': FMouseDetail,
  '03': EchoWaveDetail,
  '04': IceGleamDetail,
  '05': PuppyPoopLoopDetail,
};
import useUiScale from '../hooks/useUiScale';
import useIsMobile from '../hooks/useIsMobile';
import { useSound } from '../hooks/useSound';
import './ProjectsPage.css';

type Phase =
  | 'train-entering'   // train slides in from left (carrying robot)
  | 'train-stopped'    // train stopped, doors about to open
  | 'doors-opening'    // doors open, robot waits inside
  | 'robot-exiting'    // robot walks out of the door onto the platform
  | 'doors-closing'    // doors close
  | 'train-leaving'    // train slides off-screen right
  | 'title-showing'    // welcome title fading in/holding/fading out
  | 'projects-appearing' // project cards fade in
  | 'free-roam'        // user can move, jump at project
  | 'jumping'          // robot jumping at a project
  | 'project-detail'   // modal open
  ;

type RobotAnim = 'idle' | 'turnLeft' | 'runLeft' | 'turnRight' | 'runRight' | 'jump' | 'boardTrain';

const ROBOT_SIZE = 130;
const PLATFORM_Y = 95;
const MOVE_SPEED = 0.5;
// Keep in sync with --train-scale in ProjectsPage.css
const TRAIN_SCALE = 1.25;
const TRAIN_WIDTH_VW = 95 * TRAIN_SCALE;

// Scene is wider than viewport — project cards laid out along it.
// 300vw gives room for 5 cards plus spacing.
const SCENE_WIDTH_VW = 300;

const PROJECTS = [
  { id: '01', title: 'Teeth Defender', desc: 'Gamified toothbrush for healthy habits', xVw: 30,    image: `${import.meta.env.BASE_URL}projects/01-teeth-defender.webp` },
  { id: '02', title: 'F-Mouse',        desc: 'Accessible mouse for disabilities',     xVw: 77.5,  image: `${import.meta.env.BASE_URL}projects/02-f-mouse.webp` },
  { id: '03', title: 'EchoWave',       desc: 'Companion camera robot for kids',       xVw: 125,   image: `${import.meta.env.BASE_URL}projects/03-echowave.webp` },
  { id: '04', title: 'IceGleam',       desc: 'Ambient light for hybrid teams',        xVw: 172.5, image: `${import.meta.env.BASE_URL}projects/04-icegleam.webp` },
  { id: '05', title: 'Puppy Poop Loop', desc: 'Worm-powered dog waste system',        xVw: 220,   image: `${import.meta.env.BASE_URL}projects/05-puppy-poop-loop.webp` },
];

const TO_BE_CONTINUED_X_VW = 265;

export default function ProjectsPage() {
  const uiScale = useUiScale();
  const isMobile = useIsMobile();
  const { play } = useSound();
  // On mobile we skip the entire boarding/disembark/title sequence — start at
  // free-roam with cards already visible. The phase-gated useEffects below
  // naturally no-op because they all early-return when phase !== their target.
  const [phase, setPhase] = useState<Phase>(isMobile ? 'free-roam' : 'train-entering');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  const [robotX, setRobotX] = useState(0);     // vw in scene coordinates
  const [trainX, setTrainX] = useState(-TRAIN_WIDTH_VW);  // % from left (fully off-screen left)
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [robotVisible, setRobotVisible] = useState(false); // hidden until exits train
  const [titleOpacity, setTitleOpacity] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(isMobile);
  const [cameraX, setCameraX] = useState(0);   // vw offset applied to scene
  const [activeProject, setActiveProject] = useState<typeof PROJECTS[number] | null>(null);
  const [robotDxPx, setRobotDxPx] = useState(0);  // fine x offset in px (for disembark slide)
  const [robotDyPx, setRobotDyPx] = useState(0);  // fine y offset in px (for stepping down)

  const keysRef = useRef<Set<string>>(new Set());
  const frameLoopRef = useRef<number>(0);
  const trainAnimRef = useRef<number>(0);
  // Auto-walk: when set, the free-roam loop drives the robot toward target
  // (in scene-vw) at constant speed, optionally triggering a jump on arrival.
  const autoWalkRef = useRef<{ target: number; jumpProject: typeof PROJECTS[number] | null; speedMul?: number } | null>(null);
  // Mirrors phase for use inside event handlers / button onClick without re-binding.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const robotXRef = useRef(robotX);
  useEffect(() => { robotXRef.current = robotX; }, [robotX]);

  // Helper: door center in viewport percent
  const getDoorCenterPercent = useCallback(() => trainX + 0.835 * TRAIN_WIDTH_VW, [trainX]);

  // ═══ Phase 1: Train enters from left, stops ═══
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

  // ═══ Phase 2: Robot appears at door (idle, raised 20px), doors open, pause 500ms ═══
  useEffect(() => {
    if (phase !== 'doors-opening') return;
    // Place robot at door, idle, raised ~31px (standing on train floor)
    setRobotX(getDoorCenterPercent());
    setRobotDxPx(0);
    setRobotDyPx(-31 * uiScale);
    setRobotAnim('idle');
    setRobotVisible(true);
    // Open doors (CSS transition ~0.7s), then pause 500ms before disembark
    setDoorsOpen(true);
    const t = setTimeout(() => setPhase('robot-exiting'), 700 + 500);
    return () => clearTimeout(t);
  }, [phase, getDoorCenterPercent]);

  // ═══ Phase 3: Robot walks right 40px and steps down 20px over ~0.75s (sped up 2×) ═══
  useEffect(() => {
    if (phase !== 'robot-exiting') return;
    setRobotAnim('runRight');
    const duration = 750;
    const t0 = performance.now();
    const startDx = 0;
    const startDy = -31 * uiScale;
    const targetDx = 40 * uiScale;
    const targetDy = 0;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      // ease-out (gentle landing)
      const eased = 1 - Math.pow(1 - p, 2);
      setRobotDxPx(startDx + (targetDx - startDx) * eased);
      setRobotDyPx(startDy + (targetDy - startDy) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        // Robot has finished the disembark mini-walk. Bake the px offset
        // into scene-vw so robotX accurately reflects the visible position,
        // then immediately kick off the auto-walk to project 01 — runs in
        // parallel with door close + train departure + title fade.
        const dxVw = (targetDx / window.innerWidth) * 100;
        setRobotX(prev => {
          const startX = prev + dxVw;
          robotXRef.current = startX;
          return startX;
        });
        setRobotDxPx(0);
        setRobotDyPx(0);
        autoWalkRef.current = { target: PROJECTS[0].xVw, jumpProject: null, speedMul: 0.5 };
        setPhase('doors-closing');
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ═══ Phase 4: Doors close → train departs right ═══
  useEffect(() => {
    if (phase !== 'doors-closing') return;
    setDoorsOpen(false);
    const t = setTimeout(() => {
      setPhase('train-leaving');
    }, 800);
    return () => clearTimeout(t);
  }, [phase]);

  // ═══ Phase 5: Train slides off-screen right ═══
  useEffect(() => {
    if (phase !== 'train-leaving') return;
    play('trainDepart');
    const targetX = 100;
    const SPEED = 70; // %/s
    let currentX = trainX;
    let lastT = 0;
    let raf = 0;
    // Also trigger title fade-in in parallel
    setPhase(prev => prev); // no-op guard
    setTitleOpacity(0);
    const titleFadeIn = setTimeout(() => {
      // animate opacity via CSS transition below — simply set to 1
      setTitleOpacity(1);
    }, 200);

    const animate = (t: number) => {
      if (lastT === 0) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;
      currentX += SPEED * dt;
      if (currentX >= targetX) {
        setTrainX(targetX);
        setPhase('title-showing');
        return;
      }
      setTrainX(currentX);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(titleFadeIn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ═══ Phase 6: Title hold → fade out → projects appear ═══
  useEffect(() => {
    if (phase !== 'title-showing') return;
    const hold = setTimeout(() => {
      setTitleOpacity(0); // fade out
      setTimeout(() => {
        setPhase('projects-appearing');
        setCardsVisible(true);
        setTimeout(() => setPhase('free-roam'), 900);
      }, 450); // wait for fade-out transition (sped up 2×)
    }, 900); // hold duration (sped up 2×)
    return () => clearTimeout(hold);
  }, [phase]);

  // ═══ Keyboard ═══
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      // Manual movement cancels any in-progress auto-walk.
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        autoWalkRef.current = null;
      }
      if (e.key === ' ' && phase === 'free-roam') {
        e.preventDefault();
        // Robot triggers a jump anywhere under the card image. Card visual
        // width = 27vw × scale 1.2 = 32.4vw, so half-width ≈ 16vw from center.
        const near = PROJECTS.find(p => Math.abs(p.xVw - robotX) < 16);
        if (near) {
          play('jump');
          setActiveProject(near);
          setRobotAnim('jump');
          setPhase('jumping');
        }
      }
      if (e.key === 'Escape' && phase === 'project-detail') {
        setActiveProject(null);
        setPhase('free-roam');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase, robotX]);

  // ═══ Movement loop + camera follow ═══
  // Runs from `doors-closing` onward so the auto-walk (kicked off the moment
  // the disembark mini-walk completes) can drive the robot toward project 01
  // in parallel with door-close / train-leave / title fade.
  useEffect(() => {
    const runPhases: Phase[] = ['doors-closing', 'train-leaving', 'title-showing', 'projects-appearing', 'free-roam'];
    if (!runPhases.includes(phase)) return;
    const AUTO_SPEED_BASE = MOVE_SPEED * 0.27; // a touch faster than manual walk
    const loop = () => {
      const aw = autoWalkRef.current;
      if (aw) {
        const AUTO_SPEED = AUTO_SPEED_BASE * (aw.speedMul ?? 1);
        const cur = robotXRef.current;
        const dist = aw.target - cur;
        const absDist = Math.abs(dist);
        if (absDist < AUTO_SPEED) {
          setRobotX(aw.target);
          robotXRef.current = aw.target;
          autoWalkRef.current = null;
          if (aw.jumpProject) {
            play('jump');
            setActiveProject(aw.jumpProject);
            setRobotAnim('jump');
            setPhase('jumping');
            return; // stop the loop; phase is no longer free-roam
          }
          setRobotAnim('idle');
        } else {
          const dir: 'left' | 'right' = dist > 0 ? 'right' : 'left';
          const next = cur + (dir === 'right' ? AUTO_SPEED : -AUTO_SPEED);
          const clamped = Math.max(2, Math.min(SCENE_WIDTH_VW - 2, next));
          setRobotX(clamped);
          robotXRef.current = clamped;
          if (dir === 'left') {
            setRobotAnim(prev => (prev !== 'runLeft' && prev !== 'turnLeft') ? 'turnLeft' : prev);
          } else {
            setRobotAnim(prev => (prev !== 'runRight' && prev !== 'turnRight') ? 'turnRight' : prev);
          }
        }
        frameLoopRef.current = requestAnimationFrame(loop);
        return;
      }

      // Keyboard input only acts in free-roam.
      if (phase !== 'free-roam') {
        frameLoopRef.current = requestAnimationFrame(loop);
        return;
      }
      const keys = keysRef.current;
      let direction: 'left' | 'right' | null = null;
      if (keys.has('ArrowLeft') || keys.has('a')) direction = 'left';
      else if (keys.has('ArrowRight') || keys.has('d')) direction = 'right';

      if (direction) {
        setRobotX(prev => {
          const next = direction === 'left' ? prev - MOVE_SPEED * 0.36 : prev + MOVE_SPEED * 0.36;
          return Math.max(2, Math.min(SCENE_WIDTH_VW - 2, next));
        });
        if (direction === 'left') {
          setRobotAnim(prev => (prev !== 'runLeft' && prev !== 'turnLeft') ? 'turnLeft' : prev);
        } else {
          setRobotAnim(prev => (prev !== 'runRight' && prev !== 'turnRight') ? 'turnRight' : prev);
        }
      } else {
        setRobotAnim(prev => {
          if (prev === 'runLeft' || prev === 'runRight' || prev === 'turnLeft' || prev === 'turnRight') {
            return 'idle';
          }
          return prev;
        });
      }

      frameLoopRef.current = requestAnimationFrame(loop);
    };
    frameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameLoopRef.current);
  }, [phase]);

  // Camera follows robot — but stays at 0 while train sequence is playing,
  // so robot appears at the door (its true scene-vw position) instead of being
  // re-centered to mid-viewport the moment it becomes visible.
  useEffect(() => {
    // Pin camera while train is arriving / robot is still by the door.
    // Once disembark mini-walk completes (phase ≥ doors-closing), let the
    // camera follow the robot as it walks toward project 01.
    const lockedPhases: Phase[] = [
      'train-entering', 'train-stopped', 'doors-opening', 'robot-exiting',
    ];
    if (lockedPhases.includes(phase)) {
      setCameraX(0);
      return;
    }
    let target = robotX - 50;
    target = Math.max(0, Math.min(SCENE_WIDTH_VW - 100, target));
    setCameraX(target);
  }, [robotX, phase]);

  const onTurnComplete = useCallback(() => {
    setRobotAnim(prev => {
      if (prev === 'turnLeft') return 'runLeft';
      if (prev === 'turnRight') return 'runRight';
      return prev;
    });
  }, []);

  const onJumpComplete = useCallback(() => {
    setRobotAnim('idle');
    setPhase('project-detail');
  }, []);

  // Find nearest project index relative to current robotX (used by arrow nav).
  const getNearestProjectIndex = useCallback(() => {
    let bestIdx = 0;
    let bestDist = Infinity;
    PROJECTS.forEach((p, i) => {
      const d = Math.abs(p.xVw - robotXRef.current);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    return bestIdx;
  }, []);

  // Footstep loop — fire a short blip every ~280ms while the robot is running
  // (manual or auto-walk). Auto-pauses when robotAnim leaves runLeft/runRight.
  useEffect(() => {
    if (robotAnim !== 'runLeft' && robotAnim !== 'runRight') return;
    play('footstep');
    const id = window.setInterval(() => play('footstep'), 420);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotAnim]);

  // Walk to a project's xVw; if jumpAfter, trigger jump + open modal on arrival.
  const walkToProject = useCallback((proj: typeof PROJECTS[number], jumpAfter: boolean, speedMul?: number) => {
    if (phaseRef.current !== 'free-roam') return;
    const NEAR = 1.5; // vw — already "there"
    if (Math.abs(proj.xVw - robotXRef.current) < NEAR) {
      if (jumpAfter) {
        play('jump');
        autoWalkRef.current = null;
        setActiveProject(proj);
        setRobotAnim('jump');
        setPhase('jumping');
      }
      return;
    }
    autoWalkRef.current = { target: proj.xVw, jumpProject: jumpAfter ? proj : null, speedMul };
  }, []);

  // Arrow nav handlers — jump to neighbor of current nearest project.
  const onArrowClick = useCallback((dir: 'left' | 'right') => {
    if (phaseRef.current !== 'free-roam') return;
    const idx = getNearestProjectIndex();
    // If robot isn't actually centered on the nearest, treat current project as target;
    // otherwise step to the neighbor.
    const onTarget = Math.abs(PROJECTS[idx].xVw - robotXRef.current) < 1.5;
    let nextIdx = idx;
    if (onTarget) {
      nextIdx = dir === 'left' ? idx - 1 : idx + 1;
    } else {
      // Snap to current nearest in the chosen direction (or just nearest).
      if (dir === 'left' && PROJECTS[idx].xVw > robotXRef.current && idx > 0) nextIdx = idx - 1;
      if (dir === 'right' && PROJECTS[idx].xVw < robotXRef.current && idx < PROJECTS.length - 1) nextIdx = idx + 1;
    }
    if (nextIdx < 0 || nextIdx >= PROJECTS.length) return;
    walkToProject(PROJECTS[nextIdx], false, 2 / 1.5);
  }, [getNearestProjectIndex, walkToProject]);

  const onCardClick = useCallback((proj: typeof PROJECTS[number]) => {
    // Mobile: no robot/walk/jump sequence — open detail modal directly.
    if (isMobile) {
      setActiveProject(proj);
      setPhase('project-detail');
      return;
    }
    walkToProject(proj, true, 2 / 1.5);
  }, [walkToProject, isMobile]);

  const getCurrentSprite = () => {
    switch (robotAnim) {
      case 'idle': return { sprite: SPRITES.idle, flip: false };
      case 'turnLeft': return { sprite: SPRITES.turnToLeft, flip: true };
      case 'runLeft': return { sprite: SPRITES.runRight, flip: true };
      case 'turnRight': return { sprite: SPRITES.turnToLeft, flip: false };
      case 'runRight': return { sprite: SPRITES.runRight, flip: false };
      case 'jump': return { sprite: SPRITES.jump, flip: false };
      case 'boardTrain': return { sprite: SPRITES.boardTrain, flip: false };
    }
  };

  const { sprite: currentSprite, flip } = getCurrentSprite();
  const scale = currentSprite.scale ?? 1;
  const xOffset = currentSprite.xOffset ?? 0;
  const yOffset = currentSprite.yOffset ?? 0;
  const aspectRatio = currentSprite.frameWidth / currentSprite.frameHeight;

  return (
    <div className="projects-page" style={{ ['--ui-scale' as string]: uiScale } as CSSProperties}>
      {/* Header — same as home */}
      <SiteHeader />

      {/* Welcome title — fades in/out during train departure */}
      <div
        className="projects-title"
        style={{
          opacity: titleOpacity,
          pointerEvents: 'none',
        }}
      >
        <h1>Welcome to Xiangpeng's personal projects</h1>
      </div>

      {/* Platform — illustrated tiles spliced across the scene. Lives OUTSIDE
          .scene (so it sits below the train at the root z-stack) but mirrors
          the camera's translateX so it still pans with the rest of the world.
          Odd-index tiles are mirrored (scaleX(-1)) for symmetric seams. */}
      <div
        className="platform-row"
        style={{
          width: `${SCENE_WIDTH_VW}vw`,
          transform: `translateX(${-cameraX}vw)`,
        }}
      >
        {Array.from({ length: Math.ceil(SCENE_WIDTH_VW / 100) }, (_, i) => (
          <img
            key={i}
            className="platform-tile"
            src={`${import.meta.env.BASE_URL}sprites/platform.webp`}
            alt=""
            style={{
              left: `${i * 100}vw`,
              transform: i % 2 === 1 ? 'scaleX(-1)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Scrollable scene — camera translates this container */}
      <div
        className="scene"
        style={{
          width: `${SCENE_WIDTH_VW}vw`,
          transform: `translateX(${-cameraX}vw)`,
        }}
      >
        {/* Project cards */}
        <div className={`projects-row ${cardsVisible ? 'visible' : ''}`}>
          {PROJECTS.map(p => (
            <div
              key={p.id}
              className="project-card"
              style={{ left: `${p.xVw}vw`, cursor: phase === 'free-roam' ? 'pointer' : 'default' }}
              onClick={() => onCardClick(p)}
              role="button"
              tabIndex={phase === 'free-roam' ? 0 : -1}
              onKeyDown={(e) => { if (e.key === 'Enter') onCardClick(p); }}
            >
              <div className="project-number">{p.id}</div>
              <div className="project-thumb">
                <img src={p.image} alt={p.title} />
              </div>
              <div className="project-title">{p.title}</div>
              <div className="project-desc">{p.desc}</div>
            </div>
          ))}
        </div>

        {/* To Be Continued sign — placed on the platform after project 05 */}
        <div
          className={`to-be-continued ${cardsVisible ? 'visible' : ''}`}
          style={{ left: `${TO_BE_CONTINUED_X_VW}vw`, bottom: `calc(${100 - PLATFORM_Y}% + ${45 * uiScale}px)` }}
        >
          <img src={`${import.meta.env.BASE_URL}projects/to-be-continued.webp`} alt="To Be Continued" />
        </div>

        {/* Robot — positioned in scene coordinates */}
        {robotVisible && (
          <div
            className={`robot-container anim-${robotAnim}`}
            style={{
              left: `${robotX}vw`,
              bottom: `calc(${100 - PLATFORM_Y}% - 3px + ${45 * uiScale}px)`,
              transform: `translateX(calc(-50% + ${xOffset * uiScale + robotDxPx}px)) translateY(${yOffset * uiScale + robotDyPx}px)`,
            }}
          >
            <div className="robot-shadow" />
            {phase === 'free-roam' && robotAnim === 'idle' && (
              <div className="controls-hint">
                <kbd>←</kbd> <kbd>→</kbd> move · <kbd>Space</kbd> or click card to open
              </div>
            )}
            <SpriteAnimator
              sprite={currentSprite}
              width={ROBOT_SIZE * uiScale * scale * aspectRatio}
              height={ROBOT_SIZE * uiScale * scale}
              flipX={flip}
              playing={true}
              onComplete={
                robotAnim === 'turnLeft' || robotAnim === 'turnRight' ? onTurnComplete :
                robotAnim === 'jump' ? onJumpComplete :
                undefined
              }
            />
          </div>
        )}
      </div>

      {/* Train — in viewport coordinates (NOT inside scene, so it stays fixed during camera moves) */}
      {(phase === 'train-entering' || phase === 'train-stopped' ||
        phase === 'doors-opening' || phase === 'robot-exiting' ||
        phase === 'doors-closing' || phase === 'train-leaving') && (
        <div
          className="train-container"
          style={{
            left: `${trainX}%`,
            bottom: `calc(${100 - PLATFORM_Y}% - ${5 * uiScale}px + ${45 * uiScale}px)`,
            // No stacking context, so .train-doors' z-index escapes and competes
            // directly with .scene (z 6) for proper layering with the robot.
            zIndex: 'auto',
          }}
        >
          <img src={`${import.meta.env.BASE_URL}sprites/Final_train.png`} alt="train" className="train-body" />
          <div
            className="train-doors"
            style={{
              // Doors above scene (z 6) during opening so closed doors hide the
              // visible robot in front of train. After opening, doors drop below
              // scene so the robot is in front when walking and during closing.
              zIndex: phase === 'doors-opening' ? 30 : 4,
            }}
          >
            <img
              src="/sprites/door_panel_v3.png"
              alt="door-left"
              className={`door-panel door-left ${doorsOpen ? 'open' : ''}`}
            />
            <img
              src="/sprites/door_panel_v3.png"
              alt="door-right"
              className={`door-panel door-right ${doorsOpen ? 'open' : ''}`}
            />
          </div>
        </div>
      )}

      {/* Arrow nav — viewport-fixed, click to walk to neighbor project */}
      {phase === 'free-roam' && (() => {
        const idx = getNearestProjectIndex();
        const onTarget = Math.abs(PROJECTS[idx].xVw - robotX) < 1.5;
        const canLeft = onTarget ? idx > 0 : (PROJECTS[idx].xVw > robotX || idx > 0);
        const canRight = onTarget ? idx < PROJECTS.length - 1 : (PROJECTS[idx].xVw < robotX || idx < PROJECTS.length - 1);
        return (
          <>
            <button
              type="button"
              className="nav-arrow nav-arrow-left"
              onClick={() => onArrowClick('left')}
              disabled={!canLeft}
              aria-label="Previous project"
            >
              ‹
            </button>
            <button
              type="button"
              className="nav-arrow nav-arrow-right"
              onClick={() => onArrowClick('right')}
              disabled={!canRight}
              aria-label="Next project"
            >
              ›
            </button>
          </>
        );
      })()}

      {/* Project detail — each project has its own slide stack. Scaffolded
          projects without slides yet show a "coming soon" placeholder inside
          the same modal shell. */}
      {activeProject && phase === 'project-detail' && (() => {
        const Detail = DETAIL_COMPONENTS[activeProject.id];
        return (
          <ProjectDetailModal
            open={true}
            onClose={() => { setActiveProject(null); setPhase('free-roam'); }}
          >
            {Detail ? <Detail /> : (
              <div style={{ padding: '80px 40px', textAlign: 'center' }}>
                <h2>{activeProject.title}</h2>
                <p>{activeProject.desc}</p>
              </div>
            )}
          </ProjectDetailModal>
        );
      })()}
    </div>
  );
}
