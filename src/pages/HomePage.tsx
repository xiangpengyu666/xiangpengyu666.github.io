import { useState, useEffect, useRef, useCallback } from 'react';
import SpriteAnimator, { SPRITES } from '../components/SpriteAnimator';
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
  ;

type RobotAnim = 'idle' | 'greeting' | 'turnLeft' | 'runLeft' | 'turnRight' | 'runRight' | 'jump' | 'boardTrain';

const ROBOT_SIZE = 130;
const PLATFORM_Y = 75; // % from top where platform floor is
const MOVE_SPEED = 4;

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('idle-start');
  const [robotAnim, setRobotAnim] = useState<RobotAnim>('idle');
  const [robotX, setRobotX] = useState(50); // % from left
  const [trainX, setTrainX] = useState(-60); // % from left (off screen)
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showDestination, setShowDestination] = useState(false);
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
    const targetX = 15; // train stops here (% from left)
    let currentX = -60;

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

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      // Space to board
      if (e.key === ' ' && phase === 'doors-open') {
        const doorCenterX = getDoorCenterPercent();
        if (Math.abs(robotX - doorCenterX) < 6) {
          e.preventDefault();
          setShowHint(false);
          setPhase('boarding');
          setRobotAnim('boardTrain');
        }
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

  // Turn complete -> start running
  const onTurnComplete = useCallback(() => {
    setRobotAnim(prev => {
      if (prev === 'turnLeft') return 'runLeft';
      if (prev === 'turnRight') return 'runRight';
      return prev;
    });
  }, []);

  // Board complete -> show destination
  const onBoardComplete = useCallback(() => {
    setShowDestination(true);
    setPhase('destination');
  }, []);

  // Get door center position as percentage
  const getDoorCenterPercent = () => {
    // Door is roughly at center of train
    return trainX + 30; // approximate door center
  };

  // Get current sprite config
  const getCurrentSprite = () => {
    switch (robotAnim) {
      case 'idle': return { sprite: SPRITES.idle, flip: false };
      case 'greeting': return { sprite: SPRITES.greeting, flip: false };
      case 'turnLeft': return { sprite: SPRITES.turnToLeft, flip: false };
      case 'runLeft': return { sprite: SPRITES.runLeft, flip: false };
      case 'turnRight': return { sprite: SPRITES.turnToLeft, flip: true };
      case 'runRight': return { sprite: SPRITES.runLeft, flip: true };
      case 'jump': return { sprite: SPRITES.jump, flip: false };
      case 'boardTrain': return { sprite: SPRITES.boardTrain, flip: false };
    }
  };

  const { sprite: currentSprite, flip } = getCurrentSprite();
  const aspectRatio = currentSprite.frameWidth / currentSprite.frameHeight;

  return (
    <div className="homepage">
      {/* Background - Station */}
      <div className="station-bg">
        <div className="station-wall">
          <div className="station-sign">
            <span className="station-sign-text">HOME</span>
          </div>
          <div className="station-pillars">
            {[20, 40, 60, 80].map(x => (
              <div key={x} className="station-pillar" style={{ left: `${x}%` }} />
            ))}
          </div>
        </div>

        {/* Train */}
        <div
          className="train-container"
          style={{
            left: `${trainX}%`,
            bottom: `${100 - PLATFORM_Y + 2}%`,
          }}
        >
          <img src="/sprites/train_final_v2.png" alt="train" className="train-body" />
          {/* Doors */}
          <div className="train-doors">
            <img
              src="/sprites/door_panel_v2.png"
              alt="door-left"
              className={`door-panel door-left ${doorsOpen ? 'open' : ''}`}
            />
            <img
              src="/sprites/door_panel_v2.png"
              alt="door-right"
              className={`door-panel door-right ${doorsOpen ? 'open' : ''}`}
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        </div>

        {/* Platform */}
        <div className="platform" style={{ top: `${PLATFORM_Y}%` }}>
          <div className="platform-edge" />
          <div className="platform-floor" />
        </div>

        {/* Robot */}
        {phase !== 'destination' && (
          <div
            className="robot-container"
            style={{
              left: `${robotX}%`,
              bottom: `${100 - PLATFORM_Y}%`,
              transform: 'translateX(-50%)',
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
              width={ROBOT_SIZE * aspectRatio}
              height={ROBOT_SIZE}
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
      <div className="welcome-text">
        <h1>
          Hi! I'm <em>Xiangpeng</em>,
        </h1>
        <p>An interdisciplinary designer and engineer.</p>
        <p className="welcome-sub">Industrial Design, UX Design, IoT, Robotics</p>
      </div>

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
                    // TODO: navigate to page
                    console.log('Navigate to:', dest.label);
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
