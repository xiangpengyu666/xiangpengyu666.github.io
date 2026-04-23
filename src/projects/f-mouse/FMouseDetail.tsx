import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 12 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `F-Mouse — slide ${i + 1}`,
}));

export default function FMouseDetail() {
  return <ProjectSlideStack slug="f-mouse" slides={SLIDES} />;
}
