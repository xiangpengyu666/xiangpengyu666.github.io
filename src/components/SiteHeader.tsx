import { Link } from 'react-router-dom';
import type { MouseEvent } from 'react';

interface Props {
  /**
   * Optional interceptor for destination links in the nav. Return true to
   * cancel the default navigation (so the caller can run its own animation
   * and navigate when ready). Return false to let the Link navigate normally.
   */
  onDestinationSelect?: (path: string) => boolean;
}

/**
 * Top header shared across HomePage / ProjectsPage / WorkProjectsPage.
 * Styling lives in HomePage.css / ProjectsPage.css (shared rule set).
 *
 * The Projects entry is a hover/focus dropdown split into Personal + Work.
 * Uses CSS :hover / :focus-within — no JS state needed for the dropdown.
 */
export default function SiteHeader({ onDestinationSelect }: Props = {}) {
  const intercept = (path: string) => (e: MouseEvent) => {
    if (onDestinationSelect?.(path)) e.preventDefault();
  };

  return (
    <header className="site-header">
      <Link to="/" className="logo" aria-label="Home">Xp</Link>
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
        <Link to="/blog" onClick={intercept('/blog')}>Blog</Link>
        <Link to="/contact" onClick={intercept('/contact')}>Contact</Link>
      </nav>
    </header>
  );
}
