import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import WorkspacePage from './pages/WorkspacePage'

// highlight the search resutls
if (typeof CSS !== "undefined" && "highlights" in CSS) {
  if (!CSS.highlights.has("search-match")) {
    CSS.highlights.set("search-match", new Highlight());
  }
  if (!CSS.highlights.has("search-match-active")) {
    CSS.highlights.set("search-match-active", new Highlight());
  }
}

/* Rounter */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
