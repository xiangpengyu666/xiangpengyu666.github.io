/**
 * SoundManager — 地铁站主页音效系统
 * 
 * 三类音效：
 * 1. 角色动作音效 (robot actions)
 * 2. 地铁站环境音 (station ambience)
 * 3. UI 交互音效 (UI interactions)
 * 
 * 所有音频文件放在 public/sounds/ 下
 * 支持全局静音、分类音量控制、淡入淡出
 */

type SoundCategory = 'robot' | 'station' | 'ui';

interface SoundConfig {
  src: string;
  volume?: number;       // 0-1, default 1
  loop?: boolean;        // 无限循环
  category: SoundCategory;
  fadeIn?: number;       // 淡入时间 ms
  fadeOut?: number;      // 淡出时间 ms
  // Delay before audio.play() actually fires (ms). Useful when the visual
  // event leads the sound (e.g. jump animation has wind-up before lift-off).
  delay?: number;
  // Replay the audio N times total (e.g. 2 = play twice back-to-back).
  // Distinct from `loop: true` which loops indefinitely.
  loopCount?: number;
  // Play only a slice of the audio. clipStart (seconds) seeks the audio
  // before play; clipEnd (seconds) schedules a fadeOut+stop so the clip
  // ends gracefully instead of hard-cutting on the source's end.
  clipStart?: number;
  clipEnd?: number;
}

interface ActiveSound {
  audio: HTMLAudioElement;
  config: SoundConfig;
  fadeInterval?: number;
}

// ============================================================
// 音效清单 — 你需要准备对应的音频文件放到 public/sounds/
// 推荐来源: Pixabay (免费商用), freesound.org, soundjay.com
// 格式推荐: .mp3 (兼容性最好), .ogg (备选)
// ============================================================

// Asset paths use Vite's BASE_URL so dev (/) and gh-pages subpath both resolve.
const A = (file: string) => `${import.meta.env.BASE_URL}sounds/${file}`;

// 6 essentials wired up — ambient loop intentionally dropped.
export const SOUNDS = {
  // ---- 机器人动作 ----
  boardTrain: {
    src: A('robot-board.mp3'),           // 上车确认音（短促电子提示）
    volume: 0.5,
    category: 'robot' as SoundCategory,
  },
  greeting: {
    src: A('robot-greeting.mp3'),        // Soft Bell Ding-Dong by LegitCheese (CC0, 0.8s)
    volume: 0.6,
    category: 'robot' as SoundCategory,
    loopCount: 2,                        // 连播 2 次
  },
  footstep: {
    src: A('robot-footstep.mp3'),        // Click Pop two-part by GameAudio (CC0, 0.5s)
    volume: 0.35,
    category: 'robot' as SoundCategory,
  },
  jump: {
    src: A('robot-jump.mp3'),            // Synth swoosh by WizardOZ (CC0, 1s)
    volume: 0.7,
    category: 'robot' as SoundCategory,
    // Visual jump animation has wind-up before lift-off — delay sound 0.5s
    // so audio matches the actual lift moment.
    delay: 500,
  },

  // ---- 地铁站环境（事件触发，不循环）----
  trainDepart: {
    src: A('train-depart.mp3'),          // 列车出站 — 截取 4-6.5s + 1s 淡出
    volume: 0.4,
    category: 'station' as SoundCategory,
    clipStart: 4,
    clipEnd: 6.5,
    fadeOut: 1000,
  },
} as const;

export type SoundName = keyof typeof SOUNDS;

// ============================================================
// SoundManager 单例
// ============================================================

class SoundManager {
  private static instance: SoundManager;

  private muted = false;
  private masterVolume = 1;
  private categoryVolume: Record<SoundCategory, number> = {
    robot: 1,
    station: 1,
    ui: 1,
  };

  private cache: Map<string, HTMLAudioElement> = new Map();
  private active: Map<string, ActiveSound> = new Map();
  private unlocked = false;

  /** Sounds that were play()-ed before the user interacted with the page,
   *  so the browser blocked them (autoplay policy). They get retried as
   *  soon as the user does anything (click, key, touch, mouse move). */
  private pendingPlays: Array<() => void> = [];

  private constructor() {
    const unlock = () => {
      this.unlocked = true;
      // Flush any plays that were blocked before this gesture
      const queued = this.pendingPlays;
      this.pendingPlays = [];
      queued.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('mousemove', unlock);
      document.removeEventListener('pointerdown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('mousemove', unlock, { once: true });
    document.addEventListener('pointerdown', unlock);
  }

  /** Public hook so SoundToggle / pages can queue plays manually. */
  queuePending(fn: () => void): void {
    if (this.unlocked) fn();
    else this.pendingPlays.push(fn);
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  // ---- 预加载 ----
  preload(names?: SoundName[]): void {
    const toLoad = names || (Object.keys(SOUNDS) as SoundName[]);
    toLoad.forEach(name => {
      const config = SOUNDS[name];
      if (!this.cache.has(config.src)) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = config.src;
        this.cache.set(config.src, audio);
      }
    });
  }

  // ---- 播放 ----
  play(name: SoundName, options?: { volume?: number }): string | null {
    if (this.muted) return null;
    // Mobile (≤768px) skips audio entirely — mirrors MOBILE_BREAKPOINT in
    // useIsMobile.ts. Keep this in sync if that constant moves.
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return null;

    const config = SOUNDS[name];
    const effectiveVolume =
      (options?.volume ?? config.volume ?? 1) *
      this.masterVolume *
      this.categoryVolume[config.category];

    // 创建新的 Audio 实例（允许同一音效重叠播放）
    const audio = new Audio(config.src);
    audio.volume = config.fadeIn ? 0 : effectiveVolume;
    audio.loop = config.loop ?? false;

    const id = `${name}-${Date.now()}`;

    // Seek to clipStart before playback if configured. If metadata isn't
    // loaded yet (audio.duration NaN), set it on the loadedmetadata event.
    if (config.clipStart !== undefined) {
      const seek = () => { audio.currentTime = config.clipStart!; };
      if (Number.isFinite(audio.duration)) seek();
      else audio.addEventListener('loadedmetadata', seek, { once: true });
    }

    const startPlayback = () => audio.play().then(() => {
      // 淡入
      if (config.fadeIn) {
        this.fade(audio, 0, effectiveVolume, config.fadeIn);
      }
      // clipEnd: stop playback at the configured second (with fadeOut if set)
      // by polling currentTime — more robust than setTimeout because the
      // audio element's clock can drift / pause / underflow.
      if (config.clipEnd !== undefined) {
        const fadeOutMs = config.fadeOut ?? 0;
        const fadeStartAt = config.clipEnd - fadeOutMs / 1000;
        const tick = () => {
          if (audio.paused || audio.ended) return;
          if (audio.currentTime >= fadeStartAt) {
            this.stop(id);  // uses config.fadeOut automatically
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }).catch(err => {
      // Autoplay policy block — queue and replay on next user gesture.
      if (err && (err.name === 'NotAllowedError' || /interact/i.test(err.message))) {
        this.pendingPlays.push(() => {
          if (this.muted) return;
          startPlayback();
        });
      } else {
        console.warn(`[SoundManager] play blocked: ${name}`, err.message);
      }
    });

    if (config.delay && config.delay > 0) {
      window.setTimeout(startPlayback, config.delay);
    } else {
      startPlayback();
    }

    let playsRemaining = (config.loopCount ?? 1) - 1;
    audio.addEventListener('ended', () => {
      if (config.loop) return;
      if (playsRemaining > 0) {
        playsRemaining--;
        audio.currentTime = config.clipStart ?? 0;
        audio.play().catch(() => {});
        return;
      }
      this.active.delete(id);
    });

    this.active.set(id, { audio, config });
    return id;
  }

  // ---- 停止特定实例 ----
  stop(id: string, fadeOut?: number): void {
    const entry = this.active.get(id);
    if (!entry) return;

    const duration = fadeOut ?? entry.config.fadeOut ?? 0;
    if (duration > 0) {
      this.fade(entry.audio, entry.audio.volume, 0, duration, () => {
        entry.audio.pause();
        entry.audio.currentTime = 0;
        this.active.delete(id);
      });
    } else {
      entry.audio.pause();
      entry.audio.currentTime = 0;
      this.active.delete(id);
    }
  }

  // ---- 停止某一类所有音效 ----
  stopCategory(category: SoundCategory, fadeOut = 500): void {
    this.active.forEach((entry, id) => {
      if (entry.config.category === category) {
        this.stop(id, fadeOut);
      }
    });
  }

  // ---- 停止全部 ----
  stopAll(fadeOut = 300): void {
    this.active.forEach((_, id) => {
      this.stop(id, fadeOut);
    });
  }

  // ---- 静音切换 ----
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.active.forEach(entry => {
      entry.audio.muted = this.muted;
    });
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.active.forEach(entry => {
      entry.audio.muted = this.muted;
    });
  }

  // ---- 音量控制 ----
  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.updateAllVolumes();
  }

  setCategoryVolume(category: SoundCategory, vol: number): void {
    this.categoryVolume[category] = Math.max(0, Math.min(1, vol));
    this.updateAllVolumes();
  }

  // ---- 内部方法 ----
  private updateAllVolumes(): void {
    this.active.forEach(entry => {
      const baseVol = entry.config.volume ?? 1;
      entry.audio.volume =
        baseVol * this.masterVolume * this.categoryVolume[entry.config.category];
    });
  }

  private fade(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    duration: number,
    onDone?: () => void,
  ): void {
    const steps = 20;
    const stepTime = duration / steps;
    const stepDelta = (to - from) / steps;
    let current = from;
    let step = 0;

    const interval = window.setInterval(() => {
      step++;
      current += stepDelta;
      audio.volume = Math.max(0, Math.min(1, current));

      if (step >= steps) {
        clearInterval(interval);
        audio.volume = Math.max(0, Math.min(1, to));
        onDone?.();
      }
    }, stepTime);
  }
}

// 导出单例
export const soundManager = SoundManager.getInstance();
export default soundManager;
