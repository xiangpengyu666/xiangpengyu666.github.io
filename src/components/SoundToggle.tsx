/**
 * SoundToggle — 浮动音效开关按钮
 * 
 * 放在页面右下角，点击切换静音/非静音
 * 首次进入默认静音，用户点击后解锁音频
 */

import { useState, useEffect, type MouseEvent, type KeyboardEvent } from 'react';
import { useSound } from '../hooks/useSound';
import soundManager from '../utils/SoundManager';
import './SoundToggle.css';

export default function SoundToggle() {
  const { toggleMute, isMuted } = useSound();
  // The consent modal (App.tsx) handles the initial mute state from
  // localStorage; this toggle is just a runtime mute/unmute control.
  // hasInteracted starts true so the icon reflects current SoundManager
  // state immediately (no "press for sound" prompt — that's the modal's job).
  const [hasInteracted, setHasInteracted] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  // 3秒后隐藏 tooltip
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!hasInteracted) {
      // 第一次点击：解锁音频。事件音效（火车进站/离站、上车）会在对应
      // phase 自动触发；这里不再播放循环背景音。
      setHasInteracted(true);
      soundManager.setMuted(false);
      soundManager.preload();
    } else {
      toggleMute();
    }
    setShowTooltip(false);
    // Drop focus so a follow-up Space press (HomePage's space-to-board)
    // doesn't re-trigger this button's keyboard activation.
    e.currentTarget.blur();
  };

  // Block Space/Enter as keyboard-activation for this button entirely —
  // user explicitly wants the toggle to be mouse/touch only. Without this,
  // pressing Space while the button has focus would toggle mute.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const showMuted = !hasInteracted || isMuted;

  return (
    <div className="sound-toggle-wrapper">
      {showTooltip && (
        <div className="sound-tooltip">
          Click for sound
        </div>
      )}
      <button
        className={`sound-toggle ${showMuted ? 'muted' : 'playing'}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyDown}
        aria-label={showMuted ? 'Unmute sounds' : 'Mute sounds'}
        title={showMuted ? 'Turn on sound' : 'Turn off sound'}
      >
        {showMuted ? (
          // Muted icon
          <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          // Playing icon with animated waves
          <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path className="sound-wave wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path className="sound-wave wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
    </div>
  );
}
