import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 7 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `IceGleam — slide ${i + 1}`,
}));

export default function IceGleamDetail() {
  return <ProjectSlideStack slug="icegleam" slides={SLIDES} />;
}
