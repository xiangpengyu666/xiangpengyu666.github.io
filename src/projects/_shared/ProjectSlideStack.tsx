import { useEffect, useRef } from 'react';
import './ProjectDetail.css';

export interface Slide {
  file: string;
  alt: string;
}

interface Props {
  /** Subfolder name, e.g. "teeth-defender" (personal) or "quick-release-clip"
   *  (work). Slides are expected at public/<basePath>/<slug>/slides/<file>. */
  slug: string;
  /** Which top-level public/ subdir the project lives in. Defaults to
   *  "projects" (personal); pass "work" for Ulanzi/commercial projects. */
  basePath?: string;
  /** Ordered slide list. Empty = placeholder message for scaffolded projects
   *  that don't have assets yet. */
  slides: Slide[];
}

const BASE = import.meta.env.BASE_URL;

/**
 * Generic long-scroll slide list used by every project's detail modal.
 * Renders each slide as a <figure><img> in a 16:9 box at container width,
 * with scroll-triggered fade-up via IntersectionObserver.
 */
export default function ProjectSlideStack({ slug, basePath = 'projects', slides }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('.pd-anim');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { root: root.closest('.project-detail-container'), threshold: 0.12 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  if (slides.length === 0) {
    return (
      <div className="pd-root pd-empty" ref={rootRef}>
        <div className="pd-empty-msg">
          <p>Coming soon.</p>
          <p className="pd-empty-hint">
            Drop PNGs into <code>public/{basePath}/{slug}/slides/</code> and list them in <code>SLIDES</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-root" ref={rootRef}>
      {slides.map((s, i) => (
        <figure key={s.file} className="pd-slide-img pd-anim">
          <img
            src={`${BASE}${basePath}/${slug}/slides/${s.file}`}
            alt={s.alt}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </figure>
      ))}
    </div>
  );
}
