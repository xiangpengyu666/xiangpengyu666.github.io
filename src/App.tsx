import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkProjectsPage from './pages/WorkProjectsPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/work" element={<WorkProjectsPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
