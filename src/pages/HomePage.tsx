import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import SpriteAnimator, { SPRITES } from '../components/SpriteAnimator';
import useUiScale from '../hooks/useUiScale';
import './HomePage.css';

type Phase =
  | 'idle-start'     // robot appears idle
  | 'greeting'       // robot waves
  | 'free-roam'      // user can move, train arriving
  | 'train-arriving' // train sliding in
  | 'train-stopped'  // train stopped, doors opening
  | 'doors-open'     // doors open, waiting for user
  | 'boarding'       // user pressed space at door, boarding animation
  | 'destination'    // destination selection popup
  | 'departing'      // destination chosen, train slides off-screen right
  ;

const DEST_ROUTES: Record<string, string> = {
  Projects: '/projects',
  Gallery: '/gallery',
  Blog: '/blog',
  Contact: '/contact',
};

type RobotAnim = 'idle' | 'greeting' | 'turnLeft' | 'runLeft' | 'turnRight' | 'runRight' | 'jump' | 'boardTrain';

const ROBOT_SIZE = 130;
const PLATFORM_Y = 88; // % from top where platform floor is
const MOVE_SPEED = 0.5;
// Keep in sync with --train-scale in HomePage.css
const TRAIN_SCALE = 1.25;
const TRAIN_WIDTH_VW = 95 * TRAIN_SCALE;

export default function HomePage() {
  const uiScale = useUiScale();
  const [phase, setPhase] = useState<Phase>('idle-start');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  const [robotX, setRobotX] = useState(50); // % from left
  const [trainX, setTrainX] = useState(-TRAIN_WIDTH_VW); // % from left (fully off-screen left)
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showDestination, setShowDestination] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const navigate = useNavigate();
  const keysRef = useRef<Set<string>>(new Set());
  const frameLoopRef = useRef<number>(0);
  const trainAnimRef = useRef<number>(0);

  // Phase 1: Start with idle, then trigger greeting after 1s
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('greeting');
      setRobotAnim('greeting');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Greeting complete -> free roam + train arrives
  const onGreetingComplete = useCallback(() => {
    setRobotAnim('idle');
    setPhase('free-roam');
    // Start train arrival after a short delay
    setTimeout(() => {
      setPhase('train-arriving');
    }, 500);
  }, []);

  // Train arrival animation
  useEffect(() => {
    if (phase !== 'train-arriving') return;
    const targetX = -77;
    let currentX = -TRAIN_WIDTH_VW;

    const animate = () => {
      const diff = targetX - currentX;
      if (Math.abs(diff) < 0.3) {
        currentX = targetX;
        setTrainX(targetX);
        setPhase('train-stopped');
        // Open doors after stopping
        setTimeout(() => {
          setDoorsOpen(true);
          setPhase('doors-open');
          setShowHint(true);
        }, 800);
        return;
      }
      // Ease out
      currentX += diff * 0.04;
      setTrainX(currentX);
      trainAnimRef.current = requestAnimationFrame(animate);
    };
    trainAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(trainAnimRef.current);
  }, [phase]);

  // Departing: train slides off-screen right at constant speed, then navigates
  useEffect(() => {
    if (phase !== 'departing') return;
    const targetX = 100; // off-screen right
    const SPEED = 45;    // % of viewport per second — constant velocity
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
          const next = direction === 'left' ? prev - MOVE_SPEED * 0.15 : prev + MOVE_SPEED * 0.15;
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

  // Boarding: auto-walk robot to door center, then play board animation
  useEffect(() => {
    if (phase !== 'boarding') return;
    const targetX = getDoorCenterPercent();
    let currentX = robotX;

    if (Math.abs(currentX - targetX) < 0.3) {
      setRobotX(targetX);
      setRobotAnim('boardTrain');
      return;
    }

    setRobotAnim(currentX < targetX ? 'runRight' : 'runLeft');
    let raf = 0;
    const step = () => {
      const diff = targetX - currentX;
      if (Math.abs(diff) < 0.3) {
        currentX = targetX;
        setRobotX(targetX);
        setRobotAnim('boardTrain');
        return;
      }
      currentX += diff * 0.08;
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

  // Board complete -> close door, then show destination
  const onBoardComplete = useCallback(() => {
    setDoorsOpen(false); // door slides right (back to closed)
    setTimeout(() => {
      setShowDestination(true);
      setPhase('destination');
    }, 800); // wait for door close animation (0.7s) + small buffer
  }, []);

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
    <div className="homepage" style={{ ['--ui-scale' as string]: uiScale } as CSSProperties}>
      {/* Header — logo + nav */}
      <header className="site-header">
        <div className="logo">Xp</div>
        <nav className="site-nav">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#blog">Blog</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      {/* Welcome text */}
      <section className="welcome">
        <h1>Hi! I'm Xiangpeng,</h1>
        <h1>An interdisciplinary designer and engineer.</h1>
        <p>Industrial Design, Game Design, IoT, Robotics</p>
      </section>

      {/* Background - Station */}
      <div className="station-bg">

        {/* Train */}
        <div
          className="train-container"
          style={{
            left: `${trainX}%`,
            bottom: `calc(${100 - PLATFORM_Y}% - ${5 * uiScale}px)`,
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

        {/* Platform */}
        <div className="platform" style={{ top: `${PLATFORM_Y}%` }}>
          <div className="platform-edge" />
          <div className="platform-floor" />
        </div>

        {/* Robot — hidden once user enters destination flow (already on the train) */}
        {phase !== 'destination' && phase !== 'departing' && (
          <div
            className="robot-container"
            style={{
              left: `${robotX}%`,
              bottom: `${100 - PLATFORM_Y}%`,
              transform: `translateX(calc(-50% + ${xOffset * uiScale}px)) translateY(${yOffset * uiScale}px)`,
              // Drop robot below doors (z 30) during the closing animation so the
              // panels visually cover it as they slide back into place.
              zIndex: phase === 'boarding' && !doorsOpen ? 1 : 10,
            }}
          >
            {/* Hint bubble */}
            {showHint && (
              <div className="hint-bubble">
                <span>Move to the gate & press <kbd>Space</kbd> to board</span>
              </div>
            )}
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

      {/* Welcome text */}
      {/* Arrow key hint */}
      {(phase === 'free-roam' || phase === 'train-arriving' || phase === 'train-stopped' || phase === 'doors-open') && (
        <div className="controls-hint">
          <kbd>←</kbd> <kbd>→</kbd> to move
        </div>
      )}

      {/* Destination selection */}
      {showDestination && (
        <div className="destination-overlay">
          <div className="destination-modal">
            <h2>Where to?</h2>
            <p className="destination-sub">Select your destination</p>
            <div className="destination-options">
              {[
                { label: 'Projects', icon: '🔧', desc: 'Work · Personal · GIX' },
                { label: 'Gallery', icon: '📷', desc: 'Photography' },
                { label: 'Blog', icon: '✍️', desc: 'Writing & Thoughts' },
                { label: 'Contact', icon: '✉️', desc: "Let's connect" },
              ].map(dest => (
                <button
                  key={dest.label}
                  className="destination-btn"
                  onClick={() => {
                    setPendingRoute(DEST_ROUTES[dest.label] ?? '/');
                    setShowDestination(false);
                    setPhase('departing');
                  }}
                >
                  <span className="dest-icon">{dest.icon}</span>
                  <span className="dest-label">{dest.label}</span>
                  <span className="dest-desc">{dest.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
