import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 9 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `Puppy Poop Loop — slide ${i + 1}`,
}));

export default function PuppyPoopLoopDetail() {
  return <ProjectSlideStack slug="puppy-poop-loop" slides={SLIDES} />;
}
