/**
 * useSound — React hook，封装 SoundManager
 * 
 * 用法：
 *   const { play, stop, toggleMute, isMuted } = useSound();
 *   play('footstep');
 *   play('stationAmbience');  // 自动循环
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import soundManager, { type SoundName } from '../utils/SoundManager';

export function useSound() {
  const [muted, setMuted] = useState(soundManager.isMuted());
  const activeIds = useRef<Map<string, string>>(new Map());

  const play = useCallback((name: SoundName, options?: { volume?: number }) => {
    const id = soundManager.play(name, options);
    if (id) {
      activeIds.current.set(name, id);
    }
    return id;
  }, []);

  const stop = useCallback((nameOrId: string, fadeOut?: number) => {
    // 先检查是不是 SoundName
    const id = activeIds.current.get(nameOrId) ?? nameOrId;
    soundManager.stop(id, fadeOut);
    activeIds.current.delete(nameOrId);
  }, []);

  const stopAll = useCallback((fadeOut?: number) => {
    soundManager.stopAll(fadeOut);
    activeIds.current.clear();
  }, []);

  const toggleMute = useCallback(() => {
    const nowMuted = soundManager.toggleMute();
    setMuted(nowMuted);
    // 持久化到 localStorage
    try { localStorage.setItem('sound-muted', String(nowMuted)); } catch {}
    return nowMuted;
  }, []);

  // 初始化时读取用户偏好
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sound-muted');
      if (saved === 'true') {
        soundManager.setMuted(true);
        setMuted(true);
      }
    } catch {}
  }, []);

  // 组件卸载时清理该组件启动的音效
  useEffect(() => {
    return () => {
      activeIds.current.forEach(id => {
        soundManager.stop(id, 300);
      });
    };
  }, []);

  return {
    play,
    stop,
    stopAll,
    toggleMute,
    isMuted: muted,
    setMasterVolume: soundManager.setMasterVolume.bind(soundManager),
    setCategoryVolume: soundManager.setCategoryVolume.bind(soundManager),
  };
}
