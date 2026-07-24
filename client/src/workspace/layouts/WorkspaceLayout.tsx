import { Group, Panel, Separator } from "react-resizable-panels";
import StatusBar from "../panels/StatusBar";
import DocumentArea from "../panels/DocumentArea";
import IIIFPanel from "../panels/IIIFPanel";
import ToolBar from "../panels/ToolBar";
import QuestionnaireModal from "../panels/QuestionnaireModal";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { IIIF_AUTOHIDE_QUERY } from "../responsive";

export default function WorkspaceLayout() {
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const toggleIIIF = useWorkspaceStore((state) => state.toggleIIIF);

  // ADR-0011: below the narrower breakpoint the IIIF Manuscript panel auto-hides,
  // and restores when the window grows back. This is a viewport override layered
  // on top of the user's toggle, not a mutation of it — widen the window and the
  // panel returns to whatever the user last chose.
  const iiifTooNarrow = useMediaQuery(IIIF_AUTOHIDE_QUERY);
  const iiifVisible = showIIIF && !iiifTooNarrow;

  return (
    <div className="flex h-screen flex-col bg-[#f5f6ee]">
      {/* Overlays the whole layout, once per session, for a signed-in visitor who hasn't
          answered or skipped yet (#67). Renders nothing for anonymous visitors. */}
      <QuestionnaireModal />

      <ToolBar onToggleIIIF={toggleIIIF} />

      <div className="min-h-0 flex-1">
        <Group key={iiifVisible ? "with-iiif" : "without-iiif"} orientation="horizontal"
className="h-full">
          <Panel id="document">
            <DocumentArea />
          </Panel>

          {iiifVisible && (
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