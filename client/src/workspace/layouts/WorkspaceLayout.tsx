import { Group, Panel, Separator } from 'react-resizable-panels'
import StatusBar from '../panels/StatusBar'
import ManuscriptArea from '../panels/ManuscriptArea'
import IIIFPanel from '../panels/IIIFPanel'
import ToolBar from '../panels/ToolBar'


export default function WorkspaceLayout() {
  return (
    <div className="flex h-screen flex-col bg-[#f5f6ee]">
      <ToolBar />

      <div className="min-h-0 flex-1">
        <Group orientation="horizontal" className="h-full">
          <Panel>
            <ManuscriptArea />
          </Panel>

          <Separator className="w-1 cursor-col-resize bg-gray-200 hover:bg-gray-400" />

          <Panel defaultSize={24} minSize={16} maxSize={40}>
            <IIIFPanel />
          </Panel>
        </Group>
      </div>

      <StatusBar />
    </div>
  )
}