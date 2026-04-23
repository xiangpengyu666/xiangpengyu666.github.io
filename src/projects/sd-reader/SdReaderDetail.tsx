import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 4 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `Ulanzi 2-in-1 SD Card Reader & Storage — slide ${i + 1}`,
}));

export default function SdReaderDetail() {
  return <ProjectSlideStack basePath="work" slug="sd-reader" slides={SLIDES} />;
}
