import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import EntryNotice from './components/EntryNotice'
import LandingPage from './pages/LandingPage'
import WorkspacePage from './pages/WorkspacePage'
import LoginPage from './pages/account/LoginPage'
import SignupPage from './pages/account/SignupPage'
import CheckEmailPage from './pages/account/CheckEmailPage'
import VerifyEmailPage from './pages/account/VerifyEmailPage'
import PasswordResetRequestPage from './pages/account/PasswordResetRequestPage'
import PasswordResetKeyPage from './pages/account/PasswordResetKeyPage'
import ProfilePage from './pages/account/ProfilePage'
import { logSessionStarted } from './api/log'
import { useAuthStore } from './store/authStore'
import { getHighlight, HIGHLIGHT_PRIORITIES } from './tei/highlight'
import { useEffect } from 'react'
// Register every named highlight the app paints into, in the order that decides
// which covers which where two land on the same words. The painters in
// tei/highlight.ts register their own name on first use, so this declares
// nothing they need — it puts the whole set in the registry before either
// feature runs, from the one table that names it (HIGHLIGHT_PRIORITIES).
if (typeof CSS !== "undefined" && "highlights" in CSS) {
  for (const name of Object.keys(HIGHLIGHT_PRIORITIES)) getHighlight(name);
}

/* Rounter */
function App() {
  const probe = useAuthStore((s) => s.probe)

  useEffect(() => {
    logSessionStarted({ screen: window.location.pathname })
  }, [])

  // Who, if anyone, is signed in. Nothing waits on the answer: an anonymous visitor gets
  // the whole workspace, so the probe only ever *adds* account UI (ADR-0004).
  useEffect(() => {
    probe()
  }, [probe])

  return (
    <BrowserRouter>
      {/* At the app root, not inside a route, so it shows identically to guest and
          signed-in visitors no matter which URL they land on first (ADR-0005). */}
      <EntryNotice />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />

        {/* /account/* — the paths allauth puts in its emails are fixed by the backend's
            HEADLESS_FRONTEND_URLS (#64); these routes are where those links land. */}
        <Route path="/account/login" element={<LoginPage />} />
        <Route path="/account/signup" element={<SignupPage />} />
        <Route path="/account/verify-email/sent" element={<CheckEmailPage />} />
        <Route path="/account/verify-email/:key" element={<VerifyEmailPage />} />
        <Route path="/account/password/reset" element={<PasswordResetRequestPage />} />
        <Route path="/account/password/reset/key/:key" element={<PasswordResetKeyPage />} />
        <Route path="/account/profile" element={<ProfilePage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
