import { useEffect, useState } from 'react';

const BASE_WIDTH = 1440;
const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
// How much of the "extra" viewport width above baseline gets converted into
// UI scale. 1 = pure linear (big screens feel oversized). <1 = dampened growth.
// 0.7 means on a 2x viewport, ui-scale is ~1.7 instead of 2.0.
const UPSCALE_DAMPING = 0.5;

const compute = () => {
  const raw = window.innerWidth / BASE_WIDTH;
  const scale = raw <= 1 ? raw : 1 + (raw - 1) * UPSCALE_DAMPING;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
};

export default function useUiScale() {
  const [scale, setScale] = useState<number>(() =>
    typeof window === 'undefined' ? 1 : compute()
  );

  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return scale;
}
