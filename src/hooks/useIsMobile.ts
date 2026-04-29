import { useEffect, useState } from 'react';

/**
 * Returns true when viewport width is ≤ MOBILE_BREAKPOINT.
 * Mirrors the @media (max-width: 768px) used in src/styles/mobile.css so
 * TS-side branching (skip station scene, render cards as plain list, etc.)
 * stays in lockstep with the CSS layer.
 */
export const MOBILE_BREAKPOINT = 768;

const compute = () =>
  typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => compute());

  useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}
