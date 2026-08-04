import { useEffect, useState, type FormEvent } from "react";
import { useAuthStore } from "../../store/authStore";
import {
  fetchQuestionnaire,
  skipQuestionnaire,
  submitQuestionnaireAnswers,
  type Question,
  QuestionnaireError,
} from "../../api/questionnaire";
import { inputStyle, labelStyle, primaryBtnStyle } from "./formStyles";

/**
 * The pre-use purpose questionnaire (#67, ADR-0004; opened to guests by ADR-0007):
 * shown once per session to every visitor, guest or signed-in, before they use the
 * workspace, so stated purpose ("said") can be compared against logged Behavior Events
 * ("did"). Skip is always available and is itself a recorded answer, not a way to make
 * the modal not count as shown.
 */
export default function QuestionnaireModal() {
  const shouldShow = useAuthStore((s) => s.shouldShowQuestionnaire());
  const resolve = useAuthStore((s) => s.resolveQuestionnaire);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shouldShow) return;
    // Fire-and-forget: a failed fetch still leaves Skip usable below, so a broken
    // questionnaire endpoint cannot trap a signed-in visitor out of the workspace.
    fetchQuestionnaire()
      .then((def) => setQuestions(def.questions))
      .catch(() => setError("Could not load the questionnaire."));
  }, [shouldShow]);

  if (!shouldShow) return null;

  async function submitAndResolve(action: () => Promise<void>) {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      resolve();
    } catch (caught) {
      setError(caught instanceof QuestionnaireError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitAndResolve(() => submitQuestionnaireAnswers(answers));
  }

  function handleSkip() {
    submitAndResolve(() => skipQuestionnaire());
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="questionnaire-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-[#D8D4C3] bg-white p-6 shadow-lg">
        <h1 id="questionnaire-title" className="text-lg font-semibold text-[#52524F]">
          Before you start
        </h1>
        <p className="mt-1 text-sm text-[#6B6B67]">
          What are you hoping to do this visit? You can skip this — it's just for our records.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4">
          {(questions ?? []).map((question) => (
            <div key={question.id} className="mb-3">
              <label className={labelStyle} htmlFor={`questionnaire-${question.id}`}>
                {question.prompt}
              </label>
              <input
                id={`questionnaire-${question.id}`}
                type="text"
                className={inputStyle}
                value={answers[question.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              />
            </div>
          ))}

          <div className="mt-4 flex gap-2">
            <button type="submit" className={primaryBtnStyle} disabled={submitting || !questions}>
              {submitting ? "Saving…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="w-full rounded-md border border-[#D8D4C3] bg-white px-3 py-2 text-sm font-medium text-[#52524F] cursor-pointer transition-all hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
