import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 7 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `EchoWave — slide ${i + 1}`,
}));

export default function EchoWaveDetail() {
  return <ProjectSlideStack slug="echowave" slides={SLIDES} />;
}
