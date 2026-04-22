import { useRef, useEffect } from 'react';

import idleSrc from '../Spritesheet/idle_spritesheet.png';
import greetingSrc from '../Spritesheet/greeting_spritesheet.png';
import jumpSrc from '../Spritesheet/jump_spritesheet.png';
import boardSrc from '../Spritesheet/board_spritesheet.png';
import runRightSrc from '../Spritesheet/run_right_spritesheet.png';
import turnToRightSrc from '../Spritesheet/turn_to_right_spritesheet.png';

export interface SpriteConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  totalFrames: number;
  fps: number;
  loop: boolean;
  scale?: number;  // multiplier applied to ROBOT_SIZE, default 1
  xOffset?: number; // px to shift right, default 0
  yOffset?: number; // px to shift down, default 0
  // Per-frame extra Y offset applied to the canvas itself (negative = up).
  // Lerps from 0 → deltaY across [startFrame, endFrame], then holds at deltaY.
  frameYRamp?: { startFrame: number; endFrame: number; deltaY: number };
}

export const SPRITES: Record<string, SpriteConfig> = {
  idle: {
    src: idleSrc,
    frameWidth: 144, frameHeight: 190,
    columns: 1, totalFrames: 1, fps: 6, loop: true,
    scale: 0.8,
  },
  greeting: {
    src: greetingSrc,
    frameWidth: 315, frameHeight: 177,
    columns: 13, totalFrames: 151, fps: 24, loop: false,
    yOffset: 10,
  },
  jump: {
    src: jumpSrc,
    frameWidth: 455, frameHeight: 256,
    columns: 9, totalFrames: 54, fps: 15, loop: false,
    yOffset: 10,
  },
  boardTrain: {
    src: boardSrc,
    frameWidth: 144, frameHeight: 190,
    columns: 10, totalFrames: 48, fps: 15, loop: false,
    scale: 0.9,
    xOffset: 6,
    yOffset: 10,
    frameYRamp: { startFrame: 12, endFrame: 18, deltaY: -34 },
  },
  runRight: {
    src: runRightSrc,
    frameWidth: 1024, frameHeight: 576,
    columns: 4, totalFrames: 11, fps: 15, loop: true,
    yOffset: 10,
  },
  turnToLeft: {
    src: turnToRightSrc,
    frameWidth: 819, frameHeight: 460,
    columns: 5, totalFrames: 25, fps: 180, loop: false,
    yOffset: 10,
  },
};

interface SpriteAnimatorProps {
  sprite: SpriteConfig;
  width: number;
  height: number;
  flipX?: boolean;
  playing?: boolean;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export default function SpriteAnimator({
  sprite, width, height, flipX = false,
  playing = true, onComplete, style,
}: SpriteAnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const completedRef = useRef(false);

  // Keep latest props in refs so the animation loop never needs to be restarted on prop changes
  const spriteRef = useRef(sprite);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const flipXRef = useRef(flipX);
  const onCompleteRef = useRef(onComplete);
  spriteRef.current = sprite;
  widthRef.current = width;
  heightRef.current = height;
  flipXRef.current = flipX;
  onCompleteRef.current = onComplete;

  // Load image and reset frame state when sprite source changes
  useEffect(() => {
    imgRef.current = null;
    frameRef.current = 0;
    lastTimeRef.current = 0;
    completedRef.current = false;
    const img = new Image();
    img.src = sprite.src;
    img.onload = () => { imgRef.current = img; };
    return () => { imgRef.current = null; };
  }, [sprite.src]);

  // Single animation loop — only restarts when playing toggles
  useEffect(() => {
    if (!playing) return;

    frameRef.current = 0;
    lastTimeRef.current = 0;
    completedRef.current = false;

    const draw = (timestamp: number) => {
      const sp = spriteRef.current;
      const w = widthRef.current;
      const h = heightRef.current;
      const fx = flipXRef.current;
      const canvas = canvasRef.current;
      const img = imgRef.current;

      // Image not loaded yet — keep waiting
      if (!img || !canvas) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const interval = 1000 / sp.fps;
      if (timestamp - lastTimeRef.current >= interval) {
        lastTimeRef.current = timestamp;

        const col = frameRef.current % sp.columns;
        const row = Math.floor(frameRef.current / sp.columns);

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (fx) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          img,
          col * sp.frameWidth, row * sp.frameHeight,
          sp.frameWidth, sp.frameHeight,
          0, 0, w, h
        );
        ctx.restore();

        // Per-frame Y ramp (e.g. boardTrain steps up during frames 12-18)
        if (sp.frameYRamp) {
          const { startFrame, endFrame, deltaY } = sp.frameYRamp;
          const f = frameRef.current;
          let extraY = 0;
          if (f >= endFrame) extraY = deltaY;
          else if (f > startFrame) extraY = deltaY * ((f - startFrame) / (endFrame - startFrame));
          canvas.style.transform = `translateY(${extraY}px)`;
        } else if (canvas.style.transform) {
          canvas.style.transform = '';
        }

        frameRef.current++;
        if (frameRef.current >= sp.totalFrames) {
          if (sp.loop) {
            frameRef.current = 0;
          } else {
            frameRef.current = sp.totalFrames - 1;
            if (!completedRef.current) {
              completedRef.current = true;
              onCompleteRef.current?.();
            }
            return;
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, sprite.src]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'auto', ...style }}
    />
  );
}
