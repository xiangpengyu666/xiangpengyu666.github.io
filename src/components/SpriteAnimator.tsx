import { useRef, useEffect, useCallback } from 'react';

export interface SpriteConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  totalFrames: number;
  fps: number;
  loop: boolean;
}

export const SPRITES: Record<string, SpriteConfig> = {
  idle: {
    src: '/sprites/idle_spritesheet.png',
    frameWidth: 138, frameHeight: 185,
    columns: 4, totalFrames: 4, fps: 6, loop: true,
  },
  greeting: {
    src: '/sprites/greeting_spritesheet.png',
    frameWidth: 171, frameHeight: 193,
    columns: 15, totalFrames: 76, fps: 12, loop: false,
  },
  jump: {
    src: '/sprites/jump_spritesheet.png',
    frameWidth: 156, frameHeight: 192,
    columns: 10, totalFrames: 30, fps: 15, loop: false,
  },
  boardTrain: {
    src: '/sprites/board_train_spritesheet.png',
    frameWidth: 139, frameHeight: 191,
    columns: 10, totalFrames: 54, fps: 15, loop: false,
  },
  runLeft: {
    src: '/sprites/run_left_spritesheet.png',
    frameWidth: 105, frameHeight: 187,
    columns: 12, totalFrames: 12, fps: 15, loop: true,
  },
  turnToLeft: {
    src: '/sprites/turn_to_left_spritesheet.png',
    frameWidth: 138, frameHeight: 188,
    columns: 8, totalFrames: 16, fps: 15, loop: false,
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

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = sprite.src;
    img.onload = () => { imgRef.current = img; };
    completedRef.current = false;
    frameRef.current = 0;
    lastTimeRef.current = 0;
    return () => { imgRef.current = null; };
  }, [sprite.src]);

  const draw = useCallback((timestamp: number) => {
    if (!imgRef.current || !canvasRef.current || !playing) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const interval = 1000 / sprite.fps;
    if (timestamp - lastTimeRef.current >= interval) {
      lastTimeRef.current = timestamp;

      const col = frameRef.current % sprite.columns;
      const row = Math.floor(frameRef.current / sprite.columns);

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      if (flipX) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        imgRef.current,
        col * sprite.frameWidth, row * sprite.frameHeight,
        sprite.frameWidth, sprite.frameHeight,
        0, 0, width, height
      );
      ctx.restore();

      frameRef.current++;
      if (frameRef.current >= sprite.totalFrames) {
        if (sprite.loop) {
          frameRef.current = 0;
        } else {
          frameRef.current = sprite.totalFrames - 1;
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          return;
        }
      }
    }
    animRef.current = requestAnimationFrame(draw);
  }, [playing, sprite, width, height, flipX, onComplete]);

  useEffect(() => {
    if (playing && imgRef.current) {
      completedRef.current = false;
      frameRef.current = 0;
      animRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, draw]);

  // Keep animating for looping sprites
  useEffect(() => {
    if (playing) {
      const loop = (t: number) => {
        draw(t);
        if (playing) animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [playing, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'auto', ...style }}
    />
  );
}
