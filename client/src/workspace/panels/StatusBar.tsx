import { useManuscriptStore } from '../../store/manuscriptStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

export default function StatusBar() {
  const statusText = useWorkspaceStore((state) => state.statusText)
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts)
    return (
      <footer className="flex h-8 items-center justify-between border-t border-gray-200 bg-gray-100 px-4 text-xs text-gray-600">
        <span>{statusText}</span>
        <span>{openManuscripts.length} manuscripts open</span>
      </footer>
    )
  }