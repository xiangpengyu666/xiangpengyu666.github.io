import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 4 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `Ulanzi Cka Quick Release Clip — slide ${i + 1}`,
}));

export default function QuickReleaseClipDetail() {
  return <ProjectSlideStack basePath="work" slug="quick-release-clip" slides={SLIDES} />;
}
