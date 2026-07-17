import { Link, useNavigate } from 'react-router-dom'
import { link } from './account/AccountShell'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1>uCeltic</h1>
      <button onClick={() => navigate('/workspace')}>Open Workspace</button>
      <Link to="/account/login" className={link}>Sign in</Link>
      <Link to="/account/signup" className={link}>Register</Link>
    </div>
  )
}
