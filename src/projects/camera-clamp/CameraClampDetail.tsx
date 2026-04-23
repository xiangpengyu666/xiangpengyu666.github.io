import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = Array.from({ length: 6 }, (_, i) => ({
  file: `${String(i + 1).padStart(2, '0')}.webp`,
  alt: `Ulanzi 3-Claw Camera Clamp — slide ${i + 1}`,
}));

export default function CameraClampDetail() {
  return <ProjectSlideStack basePath="work" slug="camera-clamp" slides={SLIDES} />;
}
