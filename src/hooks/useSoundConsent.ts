import { createContext, useContext } from 'react';

/**
 * Whether the first-visit sound-consent modal has been dismissed.
 * Pages with auto-running animations / audio (HomePage, ProjectsPage, ...)
 * should gate their effects on `ready === true` so the site stays frozen
 * at "frame 0" while the modal is up.
 */
export interface SoundConsentValue {
  ready: boolean;
}

export const SoundConsentContext = createContext<SoundConsentValue>({
  ready: false,
});

export default function useSoundConsent(): SoundConsentValue {
  return useContext(SoundConsentContext);
}
