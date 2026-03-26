import { useNavigate } from 'react-router-dom'

export default function WorkspacePage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1>Workspace</h1>
      <button onClick={() => navigate('/')}>Back to Home</button>
    </div>
  )
}
