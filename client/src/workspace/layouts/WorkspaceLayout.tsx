import { Group, Panel, Separator } from "react-resizable-panels";
import StatusBar from "../panels/StatusBar";
import DocumentArea from "../panels/DocumentArea";
import IIIFPanel from "../panels/IIIFPanel";
import ToolBar from "../panels/ToolBar";
import StudyPrompt from "../panels/StudyPrompt";
import QuestionnaireModal from "../panels/QuestionnaireModal";
import { useWorkspaceStore } from "../../store/workspaceStore";

export default function WorkspaceLayout() {
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const toggleIIIF = useWorkspaceStore((state) => state.toggleIIIF);

  return (
    <div className="flex h-screen flex-col bg-[#f5f6ee]">
      {/* Overlays the whole layout, once per session, for a signed-in visitor who hasn't
          answered or skipped yet (#67). Renders nothing for anonymous visitors. */}
      <QuestionnaireModal />

      <ToolBar onToggleIIIF={toggleIIIF} />

      {/* In the flow, above the document area — it shrinks the workspace by a line, and
          never covers it. Renders nothing at all once signed in or dismissed. */}
      <StudyPrompt />

      <div className="min-h-0 flex-1">
        <Group key={showIIIF ? "with-iiif" : "without-iiif"} orientation="horizontal"
className="h-full">
          <Panel id="document">
            <DocumentArea />
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