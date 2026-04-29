import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SpriteAnimator, { SPRITES } from '../components/SpriteAnimator';
import SiteHeader from '../components/SiteHeader';
import useUiScale from '../hooks/useUiScale';
import useIsMobile from '../hooks/useIsMobile';
import { useSound } from '../hooks/useSound';
import useSoundConsent from '../hooks/useSoundConsent';
import './HomePage.css';

type Phase =
  | 'idle-start'     // robot appears idle
  | 'greeting'       // robot waves
  | 'free-roam'      // user can move, train arriving
  | 'train-arriving' // train sliding in
  | 'train-stopped'  // train stopped, doors opening
  | 'doors-open'     // doors open, waiting for user
  | 'boarding'       // user pressed space at door, boarding animation
  | 'awaiting-dest'  // robot boarded, doors closed, side-nav focused for selection
  | 'departing'      // destination chosen, train slides off-screen right
  ;

type RobotAnim = 'idle' | 'greeting' | 'turnLeft' | 'runLeft' | 'turnRight' | 'runRight' | 'jump' | 'boardTrain';

const ROBOT_SIZE = 130;
const PLATFORM_Y = 95; // % from top where platform floor is — tuned so the
                       // robot's feet land on the yellow tactile strip in
                       // platform.webp (yellow line is ~26% from image bottom).
const MOVE_SPEED = 0.5;
// Keep in sync with --train-scale in HomePage.css.
// Mobile uses a 2× scale so the train reads as the hero visual instead of
// shrinking to thumbnail size on portrait screens.
const TRAIN_SCALE_DESKTOP = 1.25;
const TRAIN_SCALE_MOBILE = 2.5;

export default function HomePage() {
  const uiScale = useUiScale();
  const isMobile = useIsMobile();
  const { play } = useSound();
  const { ready } = useSoundConsent();
  // Resolve the train geometry from the current viewport bucket. JS values
  // mirror the CSS --train-scale custom property below (set inline on the
  // root) so door-position math stays in sync with the visual.
  const trainScale = isMobile ? TRAIN_SCALE_MOBILE : TRAIN_SCALE_DESKTOP;
  const TRAIN_WIDTH_VW = 95 * trainScale;
  // Mobile (option C): skip the entire entrance sequence — train pre-parked,
  // doors already open, robot at door, ready for the user to tap a drawer
  // destination. The existing onDestinationSelect interceptor + boarding/
  // departing pipeline run unchanged from there.
  // On mobile the door (at +83.5% of the train width) is anchored to viewport
  // 50% so it lines up with the robot which also sits at 50%. trainX is
  // derived: 50 = trainX + 0.835 × trainWidth → trainX = 50 - 0.835 × width.
  const TRAIN_PARKED_X = isMobile ? 50 - 0.835 * TRAIN_WIDTH_VW : -77;
  const DOOR_PARKED_CENTER = TRAIN_PARKED_X + 0.835 * TRAIN_WIDTH_VW;
  const [phase, setPhase] = useState<Phase>(isMobile ? 'doors-open' : 'idle-start');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  // Mobile: robot stands dead-center of the viewport. Door is ~48% on mobile
  // (close enough that the boarding walk is a couple of steps, not a teleport).
  const [robotX, setRobotX] = useState(isMobile ? 50 : 50);
  const [trainX, setTrainX] = useState(isMobile ? TRAIN_PARKED_X : -TRAIN_WIDTH_VW);
  const [doorsOpen, setDoorsOpen] = useState(isMobile);
  const [showHint, setShowHint] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  // Mobile shows the side-nav from the start (positioned below welcome via
  // mobile.css), since there's no train-arriving phase to gate it.
  const [sideNavShown, setSideNavShown] = useState(isMobile);
  const [sideNavExiting, setSideNavExiting] = useState(false);
  const navigate = useNavigate();
  const keysRef = useRef<Set<string>>(new Set());
  const frameLoopRef = useRef<number>(0);
  const trainAnimRef = useRef<number>(0);
  // Phase 1: Start with idle, then trigger greeting after 1s — desktop only.
  // Gated on `ready` (from SoundConsentContext) so the entire phase machine
  // stays paused at idle-start until the user dismisses the consent modal.
  // Their button click satisfies the browser's autoplay user-gesture rule,
  // so play('greeting') 300ms after `ready` flips works without further wait.
  useEffect(() => {
    if (isMobile || !ready) return;
    const timer = setTimeout(() => {
      setPhase('greeting');
      setRobotAnim('greeting');
      play('greeting');
    }, 300);
    return () => clearTimeout(timer);
  }, [isMobile, ready]);

  // Greeting complete → free-roam briefly, then train starts arriving.
  const onGreetingComplete = useCallback(() => {
    setRobotAnim('idle');
    setPhase('free-roam');
    setTimeout(() => setPhase('train-arriving'), 200);
  }, []);

  // Footstep loop — fire a short blip every ~280ms while the robot is running
  // so the walk reads as movement instead of silence. setInterval keyed on
  // robotAnim so it auto-pauses when the robot stops / boards / etc.
  useEffect(() => {
    if (robotAnim !== 'runLeft' && robotAnim !== 'runRight') return;
    play('footstep');
    const id = window.setInterval(() => play('footstep'), 420);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotAnim]);

  // Train arrival — only after greeting finishes. Speed factor 0.02 (half of
  // the original 0.04) for a more leisurely pull-in.
  useEffect(() => {
    if (phase !== 'train-arriving') return;
    setSideNavShown(true);
    const targetX = -77;
    let currentX = -TRAIN_WIDTH_VW;
    const animate = () => {
      const diff = targetX - currentX;
      if (Math.abs(diff) < 0.3) {
        currentX = targetX;
        setTrainX(targetX);
        setPhase('train-stopped');
        setTimeout(() => {
          setDoorsOpen(true);
          setPhase('doors-open');
          setShowHint(true);
        }, 800);
        return;
      }
      currentX += diff * 0.02;
      setTrainX(currentX);
      trainAnimRef.current = requestAnimationFrame(animate);
    };
    trainAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(trainAnimRef.current);
  }, [phase]);

  // If the user picked a side-nav destination before doors finished opening,
  // wait for `doors-open` then auto-trigger the boarding sequence.
  useEffect(() => {
    if (phase === 'doors-open' && pendingRoute) {
      setShowHint(false);
      setPhase('boarding');
    }
  }, [phase, pendingRoute]);

  // Departing: train slides off-screen right at constant speed, then navigates.
  useEffect(() => {
    if (phase !== 'departing') return;
    play('trainDepart');
    const targetX = 100; // off-screen right
    // Mobile train is 2× wider (TRAIN_SCALE_MOBILE) so it has 2× more vw to
    // travel before clearing the viewport — double the speed to keep depart
    // duration consistent with desktop.
    const SPEED = isMobile ? 140 : 70;    // % of viewport per second
    let currentX = trainX;
    let lastT = 0;
    let raf = 0;
    const animate = (t: number) => {
      if (lastT === 0) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;
      currentX += SPEED * dt;
      if (currentX >= targetX) {
        setTrainX(targetX);
        if (pendingRoute) navigate(pendingRoute);
        return;
      }
      setTrainX(currentX);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      // Space to board — auto-walks to the door center, then plays board animation
      if (e.key === ' ' && phase === 'doors-open') {
        e.preventDefault();
        play('boardTrain');
        setShowHint(false);
        setPhase('boarding');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase, robotX]);

  // Movement loop
  useEffect(() => {
    const canMove = phase === 'free-roam' || phase === 'train-arriving' ||
                    phase === 'train-stopped' || phase === 'doors-open';
    if (!canMove) return;

    const loop = () => {
      const keys = keysRef.current;
      let moving = false;
      let direction: 'left' | 'right' | null = null;

      if (keys.has('ArrowLeft') || keys.has('a')) {
        direction = 'left';
        moving = true;
      } else if (keys.has('ArrowRight') || keys.has('d')) {
        direction = 'right';
        moving = true;
      }

      if (moving && direction) {
        setRobotX(prev => {
          const next = direction === 'left' ? prev - MOVE_SPEED * 0.30 : prev + MOVE_SPEED * 0.30;
          return Math.max(5, Math.min(95, next));
        });

        // Set animation
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

  // Boarding: auto-walk robot to door center at a constant speed, then play
  // the board animation. Constant speed (not lerp) so large distances look
  // like walking instead of teleporting.
  useEffect(() => {
    if (phase !== 'boarding') return;
    // play('boardTrain') is fired in the click handlers themselves (queueRoute /
    // onDestinationSelect / Space key) so the audio is in lock-step with the
    // user's tap. Doing it here adds 1–2 render cycles of latency.
    const targetX = getDoorCenterPercent();
    let currentX = robotX;

    if (Math.abs(currentX - targetX) < 0.3) {
      setRobotX(targetX);
      setRobotAnim('boardTrain');
      return;
    }

    const direction = currentX < targetX ? 1 : -1;
    setRobotAnim(direction > 0 ? 'runRight' : 'runLeft');
    const SPEED = 24; // % of viewport per second — between natural (18) and 2× (36)
    let lastT = 0;
    let raf = 0;
    const step = (t: number) => {
      if (lastT === 0) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;
      const remaining = targetX - currentX;
      const stepSize = SPEED * dt * direction;
      if (Math.abs(stepSize) >= Math.abs(remaining)) {
        currentX = targetX;
        setRobotX(targetX);
        setRobotAnim('boardTrain');
        return;
      }
      currentX += stepSize;
      setRobotX(currentX);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Turn complete -> start running
  const onTurnComplete = useCallback(() => {
    setRobotAnim(prev => {
      if (prev === 'turnLeft') return 'runLeft';
      if (prev === 'turnRight') return 'runRight';
      return prev;
    });
  }, []);

  // Board complete -> close door, then either show destination modal or,
  // if the user already chose a destination via the nav dropdown, skip the
  // modal and trigger departure directly.
  const onBoardComplete = useCallback(() => {
    setDoorsOpen(false); // door slides right (back to closed)
    setTimeout(() => {
      if (pendingRoute) {
        setPhase('departing');
      } else {
        // No preselected route — focus the side-nav so the user picks from there.
        setPhase('awaiting-dest');
      }
    }, 800); // wait for door close animation (0.7s) + small buffer
  }, [pendingRoute]);

  // Get door center position as percentage
  const getDoorCenterPercent = () => {
    // Door overlay center at 83.5% of train width (left:80% + width:7%/2)
    return trainX + 0.835 * TRAIN_WIDTH_VW;
  };

  // Get current sprite config
  const getCurrentSprite = () => {
    switch (robotAnim) {
      case 'idle': return { sprite: SPRITES.idle, flip: false };
      case 'greeting': return { sprite: SPRITES.greeting, flip: false };
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
    <div className="homepage" style={{ ['--ui-scale' as string]: uiScale, ['--train-scale' as string]: trainScale } as CSSProperties}>
      {/* Header — logo + nav */}
      <SiteHeader
        hideNav
        onDestinationSelect={(path) => {
          // Only intercept if the train is docked with doors open — otherwise
          // there's no sensible boarding animation to run, let Link navigate.
          if (phase !== 'doors-open') return false;
          play('boardTrain');
          setPendingRoute(path);
          setShowHint(false);
          setPhase('boarding');
          return true;
        }}
      />

      {/* Welcome text — only mounted after consent, so the staggered CSS
          fade-in animation runs once the user actually starts the experience
          (instead of running silently behind the modal). */}
      {ready && (
        <section className="welcome">
          <h1><span className="welcome-hi">Hi!</span> I'm Xiangpeng,</h1>
          <h1>An interdisciplinary designer and engineer.</h1>
          <p>Industrial Design, Game Design, IoT, Robotics</p>
        </section>
      )}

      {/* Background - Station */}
      <div className="station-bg">

        {/* Train */}
        <div
          className="train-container"
          style={{
            left: `${trainX}%`,
            bottom: `calc(${100 - PLATFORM_Y}% - ${5 * uiScale}px + ${45 * uiScale}px${isMobile ? ' - 25px' : ''})`,
          }}
        >
          <img src={`${import.meta.env.BASE_URL}sprites/Final_train.png`} alt="train" className="train-body" />
          {/* Doors */}
          <div
            className="train-doors"
            style={{
              // Lift doors above robot (z 10) and hint bubble (z 20) so the
              // panels cover the robot mid-board.
              zIndex: phase === 'boarding' && !doorsOpen ? 30 : 4,
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

        {/* Platform — single illustrated image anchored to viewport bottom. */}
        <img
          className="platform-img"
          src={`${import.meta.env.BASE_URL}sprites/platform.webp`}
          alt="platform"
        />

        {/* Robot — hidden once user enters destination flow (already on the train) */}
        {phase !== 'awaiting-dest' && phase !== 'departing' && (
          <div
            className={`robot-container anim-${robotAnim}`}
            style={{
              left: `${robotX}%`,
              bottom: `calc(${100 - PLATFORM_Y}% - 2px + ${45 * uiScale}px${isMobile ? ' - 31px' : ''})`,
              transform: `translateX(calc(-50% + ${xOffset * uiScale}px${isMobile ? ' - 1px' : ''})) translateY(${yOffset * uiScale}px)`,
              // Drop robot below doors (z 30) during the closing animation so the
              // panels visually cover it as they slide back into place.
              zIndex: phase === 'boarding' && !doorsOpen ? 1 : 10,
            }}
          >
            {/* Hint — same form as ProjectsPage: floats above the robot's
                head, only while idle (no keyboard input), only while the
                board prompt is active. */}
            {showHint && robotAnim === 'idle' && (
              <div className="controls-hint">
                <kbd>←</kbd> <kbd>→</kbd> to move · <kbd>Space</kbd> to board
              </div>
            )}
            {/* Ground shadow — anchored to the container's bottom so it
                stays planted on the platform when the robot's canvas
                translates up during the jump/board animation. */}
            <div className="robot-shadow" />
            <SpriteAnimator
              sprite={currentSprite}
              width={ROBOT_SIZE * uiScale * scale * aspectRatio}
              height={ROBOT_SIZE * uiScale * scale}
              flipX={flip}
              playing={true}
              onComplete={
                robotAnim === 'greeting' ? onGreetingComplete :
                robotAnim === 'turnLeft' || robotAnim === 'turnRight' ? onTurnComplete :
                robotAnim === 'boardTrain' ? onBoardComplete :
                undefined
              }
            />
          </div>
        )}

      </div>

      {/* Side nav — appears as the train pulls in, persists until the user
          clicks one. Click triggers a 400ms fade-out, then navigates. */}
      {sideNavShown && (() => {
        const queueRoute = (path: string) => {
          if (sideNavExiting) return;
          // Fire boarding sound immediately on click (no React render delay).
          // Skip if we're already past doors-open — the depart sound will
          // take over from the existing departing useEffect.
          if (phase === 'doors-open') {
            play('boardTrain');
          }
          setPendingRoute(path);
          setSideNavExiting(true);
          // If the robot has already boarded and we're waiting for a
          // destination, depart immediately. Otherwise the doors-open effect
          // above will run the full walk → board → close → depart sequence.
          if (phase === 'awaiting-dest') {
            setPhase('departing');
          }
        };
        return (
          <nav className={`side-nav ${sideNavExiting ? 'exiting' : ''} ${phase === 'awaiting-dest' ? 'focused' : ''}`}>
            <Link to="/about" onClick={(e) => { e.preventDefault(); queueRoute('/about'); }}>About</Link>
            {isMobile ? (
              // Mobile: flat list — no dropdown, both Personal + Work top-level.
              <>
                <Link to="/projects" onClick={(e) => { e.preventDefault(); queueRoute('/projects'); }}>Personal Projects</Link>
                <Link to="/work" onClick={(e) => { e.preventDefault(); queueRoute('/work'); }}>Work Projects</Link>
              </>
            ) : (
              // Desktop: Projects expands to Personal/Work on hover/focus/tap.
              <div className="side-nav-dropdown">
                <button
                  type="button"
                  className="side-nav-trigger"
                  onClick={(e) => {
                    e.currentTarget.parentElement?.classList.toggle('open');
                  }}
                >
                  Projects
                </button>
                <div className="side-nav-sub">
                  <Link to="/projects" onClick={(e) => { e.preventDefault(); queueRoute('/projects'); }}>Personal</Link>
                  <Link to="/work" onClick={(e) => { e.preventDefault(); queueRoute('/work'); }}>Work</Link>
                </div>
              </div>
            )}
            <Link to="/contact" onClick={(e) => { e.preventDefault(); queueRoute('/contact'); }}>Contact</Link>
          </nav>
        );
      })()}


      {/* Side-nav focus dim — covers the scene when the robot is awaiting a
          destination, so attention shifts to the right-side options. */}
      {phase === 'awaiting-dest' && <div className="side-nav-focus-dim" />}
    </div>
  );
}
