import StatusBar from "../panels/StatusBar";
import DocumentArea from "../panels/DocumentArea";
import ToolBar from "../panels/ToolBar";
import FeedbackButton from "../panels/FeedbackButton";
import SpotlightTour from "../tour/SpotlightTour";

export default function WorkspaceLayout() {
  return (
    <div className="flex h-screen flex-col bg-[#f5f6ee]">
      {/* The pre-use questionnaire is deliberately not rendered here: it has no question
          set worth asking, so the workspace asks nothing (#183, ADR-0023). The component,
          its store state and its endpoints all still stand — restoring it is adding
          `<QuestionnaireModal />` back on this line. */}

      {/* First-run spotlight tour of the select-to-search flow; re-openable via the
          toolbar Help button. Non-blocking, so it never traps the workspace (#125). */}
      <SpotlightTour />

      <ToolBar />

      {/* The one strip of Columns — Documents and Manuscripts alike, at every width
          (ADR-0019, ADR-0025). There is no side panel beside it. */}
      <div className="min-h-0 flex-1">
        <DocumentArea />
      </div>

      {/* Floating, always available at every width — unlike the tool bar, which folds
          its controls away below `xl` (ADR-0011). Sits just above the StatusBar and
          below the one-shot overlay layer above (#137, ADR-0014). */}
      <FeedbackButton />

      <StatusBar />
    </div>
  );
}