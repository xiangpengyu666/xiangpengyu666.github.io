import ProjectSlideStack, { type Slide } from '../_shared/ProjectSlideStack';

const SLIDES: Slide[] = [
  { file: '01.webp', alt: 'Teeth Defender — cover' },
  { file: '02.webp', alt: 'Persona and product key insights' },
  { file: '03.webp', alt: 'Gamification — map and game parts' },
  { file: '04.webp', alt: 'Toothbrush product — exploded view and composition' },
  { file: '05.webp', alt: 'Toothbrush using method' },
  { file: '06.webp', alt: 'Game Chapter 01 — brushing flow' },
  { file: '07.webp', alt: 'Game Chapter 02 — battle flow' },
  { file: '08.webp', alt: 'User scenario — smart mirror' },
];

export default function TeethDefenderDetail() {
  return <ProjectSlideStack slug="teeth-defender" slides={SLIDES} />;
}
