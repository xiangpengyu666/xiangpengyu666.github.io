import soundManager from '../utils/SoundManager';
import './SoundConsentModal.css';

interface Props {
  /** Called once with the user's choice. App.tsx persists state and unmounts
   *  this modal, then mounts the routed content for the first time. */
  onChoose: (enableSound: boolean) => void;
}

/**
 * First-visit modal asking whether to enable audio. Renders alone (no page
 * underneath) until the user picks — App.tsx gates `<Routes>` behind this
 * choice so the rest of the site (animations, timers, audio) starts only
 * after consent. The button click also serves as the browser's required
 * "user gesture" for subsequent audio.play() calls.
 */
export default function SoundConsentModal({ onChoose }: Props) {
  return (
    <div className="sound-consent-overlay" role="dialog" aria-modal="true">
      <div className="sound-consent-card">
        <div className="sound-consent-icon" aria-hidden>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </div>
        <h2 className="sound-consent-title">Enable sound?</h2>
        <p className="sound-consent-body">
          You can toggle anytime in the bottom-right.
        </p>
        <div className="sound-consent-actions">
          <button
            type="button"
            className="sound-consent-btn primary"
            onClick={() => {
              soundManager.setMuted(false);
              soundManager.preload();
              onChoose(true);
            }}
          >
            Yes
          </button>
          <button
            type="button"
            className="sound-consent-btn"
            onClick={() => {
              soundManager.setMuted(true);
              onChoose(false);
            }}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
