import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

interface Props {
  /**
   * Optional interceptor for destination links in the nav. Return true to
   * cancel the default navigation (so the caller can run its own animation
   * and navigate when ready). Return false to let the Link navigate normally.
   */
  onDestinationSelect?: (path: string) => boolean;
  /** Hide the nav links entirely on DESKTOP — only the Xp logo is rendered.
   *  The mobile hamburger drawer still works because it replaces both the
   *  top nav (regular pages) and the side-nav (HomePage) on small viewports. */
  hideNav?: boolean;
}

/**
 * Top header shared across HomePage / ProjectsPage / WorkProjectsPage / AboutPage.
 * Styling lives in HomePage.css / ProjectsPage.css (shared rule set).
 *
 * Desktop: Projects entry is a hover/focus dropdown (Personal + Work).
 * Mobile (<768px): top nav hidden, hamburger button toggles a full-screen
 * drawer with the same destinations. Drawer respects onDestinationSelect so
 * HomePage's boarding sequence still runs from mobile drawer taps.
 */
export default function SiteHeader({ onDestinationSelect, hideNav }: Props = {}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const intercept = (path: string) => (e: MouseEvent) => {
    if (onDestinationSelect?.(path)) e.preventDefault();
    setDrawerOpen(false);
  };

  // Lock body scroll while drawer is open — otherwise rubber-band scroll on
  // iOS shows the page beneath through the overlay.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen]);

  return (
    <header className="site-header">
      <Link to="/" className="logo" aria-label="Home" onClick={() => setDrawerOpen(false)}>Xp</Link>
      {!hideNav && (
      <nav className="site-nav">
        <Link to="/about" onClick={intercept('/about')}>About</Link>
        <div className="nav-dropdown">
          <button type="button" className="nav-dropdown-trigger">Projects</button>
          <div className="nav-dropdown-menu" role="menu">
            <div className="nav-dropdown-panel">
              <Link to="/projects" role="menuitem" onClick={intercept('/projects')}>Personal</Link>
              <Link to="/work" role="menuitem" onClick={intercept('/work')}>Work</Link>
            </div>
          </div>
        </div>
        <Link to="/contact" onClick={intercept('/contact')}>Contact</Link>
      </nav>
      )}

      {/* Hamburger — shown only <768px via CSS. Always rendered so HomePage
          (which sets hideNav) still has nav access on mobile. */}
      <button
        type="button"
        className={`hamburger ${drawerOpen ? 'open' : ''}`}
        aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>

      {/* Drawer overlay + panel. CSS hides everything in this block above 768px. */}
      <div
        className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}
        aria-hidden={!drawerOpen}
      >
        <Link to="/about" onClick={intercept('/about')}>About</Link>
        <Link to="/projects" onClick={intercept('/projects')}>Personal Projects</Link>
        <Link to="/work" onClick={intercept('/work')}>Work Projects</Link>
        <Link to="/contact" onClick={intercept('/contact')}>Contact</Link>
      </aside>
    </header>
  );
}
