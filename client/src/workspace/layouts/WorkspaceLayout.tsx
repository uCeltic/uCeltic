import { Group, Panel, Separator } from 'react-resizable-panels'
import Sidebar from '../panels/Sidebar'
import ManuscriptArea from '../panels/ManuscriptArea'
import IIIFPanel from '../panels/IIIFPanel'
import BottomPanel from '../panels/BottomPanel'
import StatusBar from '../panels/StatusBar'



export default function WorkspaceLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Group orientation="horizontal" className="flex-1">
        {/* left sidebar */}
        <Panel defaultSize={15} minSize={0} collapsible>
          <Sidebar />
        </Panel>
        <Separator className="w-1 cursor-col-resize bg-gray-200 hover:bg-gray-400" />

        {/* middle main area */}
        <Panel>
          <Group orientation="vertical">
            {/* manuscript area */}
            <Panel>
              <ManuscriptArea />
            </Panel>
            <Separator className="h-1 cursor-row-resize bg-gray-200 hover:bg-gray-400" />

            {/* bottom panel */}
            <Panel defaultSize={25} minSize={0} collapsible>
              <BottomPanel />
            </Panel>
          </Group>
        </Panel>

        {/* right IIIF panel */}
        <Panel defaultSize={20} minSize={0} collapsible>
          <IIIFPanel />
        </Panel>
      </Group>

      {/* status bar */}
      <StatusBar />
    </div>
  )
}