import { useNavigate } from 'react-router-dom'
import WorkspaceLayout from '../workspace/layouts/WorkspaceLayout'

export default function WorkspacePage() {
  const navigate = useNavigate()

  return (
    <WorkspaceLayout />
    // <div>
    //   <h1>Workspace</h1>
    //   <button onClick={() => navigate('/')}>Back to Home</button>
    // </div>
  )
}
