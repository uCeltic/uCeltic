import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1>uCeltic</h1>
      <button onClick={() => navigate('/workspace')}>Open Workspace</button>
    </div>
  )
}
