import { Group, Panel, Separator } from "react-resizable-panels";
import StatusBar from "../panels/StatusBar";
import ManuscriptArea from "../panels/ManuscriptArea";
import IIIFPanel from "../panels/IIIFPanel";
import ToolBar from "../panels/ToolBar";
import { useWorkspaceStore } from "../../store/workspaceStore";

export default function WorkspaceLayout() {
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const toggleIIIF = useWorkspaceStore((state) => state.toggleIIIF);

  return (
    <div className="flex h-screen flex-col bg-[#f5f6ee]">
      <ToolBar onToggleIIIF={toggleIIIF} />

      <div className="min-h-0 flex-1">
        <Group key={showIIIF ? "with-iiif" : "without-iiif"} orientation="horizontal"
className="h-full">
          <Panel id="manuscript">
            <ManuscriptArea />
          </Panel>

          {showIIIF && (
            <>
              <Separator className="w-1 cursor-col-resize bg-gray-200 hover:bg-gray-400" />
              <Panel id="iiif" defaultSize="25%" minSize="15%" maxSize="50%">
                <IIIFPanel />
              </Panel>
            </>
          )}
        </Group>
      </div>

      <StatusBar />
    </div>
  );
}