import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkProjectsPage from './pages/WorkProjectsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import SoundToggle from './components/SoundToggle';
import SoundConsentModal from './components/SoundConsentModal';
import soundManager from './utils/SoundManager';
import { SoundConsentContext } from './hooks/useSoundConsent';
import useIsMobile from './hooks/useIsMobile';
// Loaded LAST so its @media (max-width:768px) overrides win source-order ties
// against page-specific CSS imported via the page modules above.
import './styles/mobile.css';

const CONSENT_KEY = 'sound-consent';
const MUTE_KEY = 'sound-muted';

function App() {
  const isMobile = useIsMobile();

  // The routed page tree always renders so the modal sits on top of the
  // site's actual "frame 0" (white background + logo + robot + platform)
  // rather than a blank dark overlay. Pages still gate their auto-running
  // animations / audio on the `ready` value from SoundConsentContext, so
  // nothing actually starts until the user dismisses the modal.
  // Mobile bypasses the modal entirely — audio is disabled on mobile, so
  // start as "consented" so pages don't sit waiting for a modal that never
  // renders.
  const [consented, setConsented] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return true;
    try {
      return localStorage.getItem(CONSENT_KEY) === 'yes';
    } catch {
      return false;
    }
  });

  // Apply the persisted mute state from a previous visit (returning users).
  useEffect(() => {
    if (!consented) return;
    if (isMobile) {
      soundManager.setMuted(true);
      return;
    }
    try {
      const muted = localStorage.getItem(MUTE_KEY) === 'true';
      soundManager.setMuted(muted);
    } catch { /* ignore */ }
  }, [consented, isMobile]);

  const handleChoose = (enableSound: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, 'yes');
      localStorage.setItem(MUTE_KEY, String(!enableSound));
    } catch { /* ignore */ }
    setConsented(true);
  };

  return (
    <SoundConsentContext.Provider value={{ ready: consented }}>
      <HashRouter>
        {consented && !isMobile && <SoundToggle />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/work" element={<WorkProjectsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
        {!consented && !isMobile && <SoundConsentModal onChoose={handleChoose} />}
      </HashRouter>
    </SoundConsentContext.Provider>
  );
}

export default App;
