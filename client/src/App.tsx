import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import WorkspacePage from './pages/WorkspacePage'
import { logSessionStarted } from './api/log'
import { useEffect } from 'react'
// highlight the search resutls
if (typeof CSS !== "undefined" && "highlights" in CSS) {
  if (!CSS.highlights.has("search-match-active")) {
    CSS.highlights.set("search-match-active", new Highlight());
  }
}

/* Rounter */
function App() {
  useEffect(() => {
    logSessionStarted({ screen: window.location.pathname })
  }, [])
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
