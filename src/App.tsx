import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkProjectsPage from './pages/WorkProjectsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
// Loaded LAST so its @media (max-width:768px) overrides win source-order ties
// against page-specific CSS imported via the page modules above.
import './styles/mobile.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/work" element={<WorkProjectsPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
