import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import SpriteAnimator, { SPRITES } from '../components/SpriteAnimator';
import SiteHeader from '../components/SiteHeader';
import useUiScale from '../hooks/useUiScale';
import ProjectDetailModal from '../components/ProjectDetailModal';
import QuickReleaseClipDetail from '../projects/quick-release-clip/QuickReleaseClipDetail';
import CameraClampDetail from '../projects/camera-clamp/CameraClampDetail';
import SdReaderDetail from '../projects/sd-reader/SdReaderDetail';
import './ProjectsPage.css';
import './WorkProjectsPage.css';

const DETAIL_COMPONENTS: Record<string, () => JSX.Element> = {
  '01': QuickReleaseClipDetail,
  '02': CameraClampDetail,
  '03': SdReaderDetail,
};

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
const PLATFORM_Y = 88;
const MOVE_SPEED = 0.5;
// Keep in sync with --train-scale in WorkProjectsPage.css
const TRAIN_SCALE = 1.25;
const TRAIN_WIDTH_VW = 95 * TRAIN_SCALE;

// 3 cards with tightened spacing (reduced 50+25=75px total from the original
// 47.5vw), followed by the shared to-be-continued sign which rides along.
const SCENE_WIDTH_VW = 192.639;
const TO_BE_CONTINUED_X_VW = 158.542;

// objectPosition mirrors the Figma crops: source images are portrait, the
// card container is square, so object-fit: cover + a custom Y position shows
// the same slice as in the Figma design.
// Figma shows only the product name under each image — no secondary desc line.
// Spacing is 42.292vw (= 47.5vw − 75px at 1440 baseline) center-to-center.
const PROJECTS = [
  { id: '01', title: 'Ulanzi Cka Quick Release Clip',          xVw: 30,      image: `${import.meta.env.BASE_URL}work/01-quick-release-clip.webp`, objectPosition: 'center 70%' },
  { id: '02', title: 'Ulanzi 3-Claw Camera Clamp',             xVw: 72.292,  image: `${import.meta.env.BASE_URL}work/02-camera-clamp.webp`,        objectPosition: 'center center' },
  { id: '03', title: 'Ulanzi 2-in-1 SD Card Reader & Storage', xVw: 114.584, image: `${import.meta.env.BASE_URL}work/03-sd-reader.webp`,           objectPosition: 'center 8%' },
];

export default function WorkProjectsPage() {
  const uiScale = useUiScale();
  const [phase, setPhase] = useState<Phase>('train-entering');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  const [robotX, setRobotX] = useState(0);     // vw in scene coordinates
  const [trainX, setTrainX] = useState(-TRAIN_WIDTH_VW);  // % from left (fully off-screen left)
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [robotVisible, setRobotVisible] = useState(false); // hidden until exits train
  const [titleOpacity, setTitleOpacity] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [cameraX, setCameraX] = useState(0);   // vw offset applied to scene
  const [activeProject, setActiveProject] = useState<typeof PROJECTS[number] | null>(null);
  const [robotDxPx, setRobotDxPx] = useState(0);  // fine x offset in px (for disembark slide)
  const [robotDyPx, setRobotDyPx] = useState(0);  // fine y offset in px (for stepping down)

  const keysRef = useRef<Set<string>>(new Set());
  const frameLoopRef = useRef<number>(0);
  const trainAnimRef = useRef<number>(0);

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

  // ═══ Phase 3: Robot walks right 40px and steps down 20px over ~1.5s ═══
  useEffect(() => {
    if (phase !== 'robot-exiting') return;
    setRobotAnim('runRight');
    const duration = 1500;
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
        setRobotAnim('idle');
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
    const targetX = 100;
    const SPEED = 45; // %/s
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
      }, 900); // wait for fade-out transition
    }, 1800); // hold duration
    return () => clearTimeout(hold);
  }, [phase]);

  // ═══ Keyboard ═══
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === ' ' && phase === 'free-roam') {
        e.preventDefault();
        // Check if robot is near any project (within 6vw of card center)
        const near = PROJECTS.find(p => Math.abs(p.xVw - robotX) < 6);
        if (near) {
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
  useEffect(() => {
    if (phase !== 'free-roam') return;
    // Convert any leftover px offset from the disembark into scene-vw before
    // resetting, so the robot's visible position doesn't snap.
    if (robotDxPx !== 0 || robotDyPx !== 0) {
      const dxVw = (robotDxPx / window.innerWidth) * 100;
      setRobotX(prev => prev + dxVw);
      setRobotDxPx(0);
      setRobotDyPx(0);
    }
    const loop = () => {
      const keys = keysRef.current;
      let direction: 'left' | 'right' | null = null;
      if (keys.has('ArrowLeft') || keys.has('a')) direction = 'left';
      else if (keys.has('ArrowRight') || keys.has('d')) direction = 'right';

      if (direction) {
        setRobotX(prev => {
          const next = direction === 'left' ? prev - MOVE_SPEED * 0.18 : prev + MOVE_SPEED * 0.18;
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
    const trainPhases: Phase[] = [
      'train-entering', 'train-stopped', 'doors-opening',
      'robot-exiting', 'doors-closing', 'train-leaving',
    ];
    if (trainPhases.includes(phase)) {
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
    <div className="projects-page work-projects-page" style={{ ['--ui-scale' as string]: uiScale } as CSSProperties}>
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
        <h1>Welcome to Xiangpeng's work projects</h1>
      </div>

      {/* Scrollable scene — camera translates this container */}
      <div
        className="scene"
        style={{
          width: `${SCENE_WIDTH_VW}vw`,
          transform: `translateX(${-cameraX}vw)`,
        }}
      >
        {/* Platform */}
        <div className="platform" style={{ top: `${PLATFORM_Y}%` }}>
          <div className="platform-edge" />
          <div className="platform-floor" />
        </div>

        {/* Project cards */}
        <div className={`projects-row ${cardsVisible ? 'visible' : ''}`}>
          {PROJECTS.map(p => (
            <div
              key={p.id}
              className="project-card"
              style={{ left: `${p.xVw}vw` }}
            >
              <div className="project-number">{p.id}</div>
              <div className="project-thumb">
                <img src={p.image} alt={p.title} style={{ objectPosition: p.objectPosition }} />
              </div>
              <div className="project-title">{p.title}</div>
            </div>
          ))}
        </div>

        {/* To Be Continued sign — shared with personal projects page */}
        <div
          className={`to-be-continued ${cardsVisible ? 'visible' : ''}`}
          style={{ left: `${TO_BE_CONTINUED_X_VW}vw`, bottom: `${100 - PLATFORM_Y}%` }}
        >
          <img src={`${import.meta.env.BASE_URL}projects/to-be-continued.webp`} alt="To Be Continued" />
        </div>

        {/* Robot — positioned in scene coordinates */}
        {robotVisible && (
          <div
            className="robot-container"
            style={{
              left: `${robotX}vw`,
              bottom: `calc(${100 - PLATFORM_Y}% - 3px)`,
              transform: `translateX(calc(-50% + ${xOffset * uiScale + robotDxPx}px)) translateY(${yOffset * uiScale + robotDyPx}px)`,
            }}
          >
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
            bottom: `calc(${100 - PLATFORM_Y}% - ${5 * uiScale}px)`,
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

      {/* Controls hint */}
      {phase === 'free-roam' && (
        <div className="controls-hint">
          <kbd>←</kbd> <kbd>→</kbd> move · <kbd>Space</kbd> open project
        </div>
      )}

      {/* Project detail — shared Behance-style modal + per-project slide stack */}
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
              </div>
            )}
          </ProjectDetailModal>
        );
      })()}
    </div>
  );
}
