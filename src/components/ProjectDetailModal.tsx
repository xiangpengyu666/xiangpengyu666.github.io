import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import './ProjectDetailModal.css';

// Scale for buttons / padding — tracks the modal width's proportion. As the
// modal grows (or shrinks) relative to its 1440-baseline size, everything in
// the chrome scales with it. Extra CHROME_SHRINK factor dials down the
// overall button/padding bulk without affecting the modal itself.
const PDM_BASE = 1440;
const CHROME_SHRINK = 1.5;
const computePdmScale = () => {
  if (typeof window === 'undefined') return 1 / CHROME_SHRINK;
  const modalAtCurrent = Math.min(DEFAULT_CAP, window.innerWidth * DEFAULT_RATIO);
  const modalAtBaseline = PDM_BASE * DEFAULT_RATIO;
  return (modalAtCurrent / modalAtBaseline) / CHROME_SHRINK;
};

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

// "100%" width is now viewport-proportional (67% of viewport) up to a 1650px
// cap on very large screens. That keeps the modal at roughly 2/3 of any
// screen instead of filling small viewports. Min/Max are dynamic too so the
// ± buttons stay consistent with the current screen.
const DEFAULT_RATIO = 0.67;
const DEFAULT_CAP = 1650;
const STEP = 200;

const computeDefaultWidth = () => {
  if (typeof window === 'undefined') return DEFAULT_CAP;
  return Math.round(Math.min(DEFAULT_CAP, window.innerWidth * DEFAULT_RATIO));
};
const computeMinWidth = () => {
  if (typeof window === 'undefined') return 800;
  return Math.round(Math.max(240, window.innerWidth * 0.32));
};
const computeMaxWidth = () => {
  if (typeof window === 'undefined') return 2400;
  return Math.round(Math.min(2400, window.innerWidth * 0.92));
};

/**
 * Behance-style project detail modal. Full-viewport overlay with a centered
 * scrollable container that hosts the long-scroll slides.
 *
 * Width control (top-left): shrinks/grows the container's max-width so the
 * slide images (width: 100%) scale with it. Not a CSS zoom — just layout.
 * Close triggers: Esc, backdrop click, or the × button.
 */
export default function ProjectDetailModal({ open, onClose, children }: Props) {
  const [defaultWidth, setDefaultWidth] = useState<number>(() => computeDefaultWidth());
  const [minWidth, setMinWidth] = useState<number>(() => computeMinWidth());
  const [maxWidth, setMaxWidth] = useState<number>(() => computeMaxWidth());
  const [width, setWidth] = useState<number>(() => computeDefaultWidth());
  const [pdmScale, setPdmScale] = useState<number>(() => computePdmScale());

  // Keep pdm-scale + viewport-derived bounds in sync with window resize, only
  // while the modal is open. Resizing also snaps the current width to the new
  // default so the modal stays at "~2/3 of viewport" as the window changes.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setPdmScale(computePdmScale());
      const d = computeDefaultWidth();
      setDefaultWidth(d);
      setMinWidth(computeMinWidth());
      setMaxWidth(computeMaxWidth());
      setWidth(d);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // Write --pdm-scale onto <html> so it cascades into the modal's three DOM
  // subtrees (overlay, zoom control, close button — all Fragment siblings).
  useEffect(() => {
    if (!open) return;
    document.documentElement.style.setProperty('--pdm-scale', String(pdmScale));
    return () => {
      document.documentElement.style.removeProperty('--pdm-scale');
    };
  }, [open, pdmScale]);

  // Reset width on open to the current viewport's default
  useEffect(() => {
    if (open) setWidth(computeDefaultWidth());
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const shrink = () => setWidth(w => Math.max(minWidth, w - STEP));
  const grow   = () => setWidth(w => Math.min(maxWidth, w + STEP));
  const reset  = () => setWidth(defaultWidth);

  return (
    <>
      <div className="project-detail-overlay" onClick={onClose}>
        <div
          className="project-detail-container"
          onClick={(e) => e.stopPropagation()}
          style={{ ['--pdm-width' as string]: `${width}px` } as CSSProperties}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>

      {/* Controls render OUTSIDE the overlay DOM tree so their position:fixed
          is anchored to the viewport, not to overlay (which has backdrop-filter
          → would otherwise become their containing block). */}
      <div className="project-detail-zoom">
        <button
          type="button"
          className="pdm-zoom-btn"
          aria-label="Narrower"
          onClick={shrink}
          disabled={width <= minWidth}
        >−</button>
        <button
          type="button"
          className="pdm-zoom-reset"
          aria-label="Reset width"
          onClick={reset}
          title="Reset width"
        >
          {Math.round((width / defaultWidth) * 100)}%
        </button>
        <button
          type="button"
          className="pdm-zoom-btn"
          aria-label="Wider"
          onClick={grow}
          disabled={width >= maxWidth}
        >+</button>
      </div>

      <button
        type="button"
        className="project-detail-close"
        aria-label="Close"
        onClick={onClose}
      >×</button>
    </>
  );
}
