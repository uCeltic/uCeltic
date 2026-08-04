import { useEffect, useState, type FormEvent } from "react";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_CONTACT_MAX_LENGTH,
  FeedbackError,
  submitFeedback,
  type FeedbackCategory,
} from "../../api/feedback";
import { logEvent } from "../../api/log";
import { buildFeedbackContext } from "./feedbackContext";
import { inputStyle, labelStyle, primaryBtnStyle } from "./formStyles";
import { useDismissableDropdown } from "./useDismissableDropdown";

/** How long the thank-you stays up before the popover closes itself. */
export const FEEDBACK_CONFIRMATION_MS = 1600;

// The three triage buckets, named as CONTEXT.md's Feedback entry names them — the label
// a visitor picks and the `category` a maintainer filters admin by are the same word.
const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];

function CategoryChoice({
  value,
  label,
  checked,
  onSelect,
}: {
  value: FeedbackCategory;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-all
        ${checked ? "border-[#52524F] bg-[#F0EEE6] font-medium text-[#52524F]" : "border-[#E5E2D6] bg-white text-gray-600 hover:bg-[#F0EEE6]"}`}
    >
      <input
        type="radio"
        name="feedback-category"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="accent-[#52524F]"
      />
      {label}
    </label>
  );
}

/**
 * The always-available Feedback button (#137, ADR-0014): a floating trigger that never
 * hides, and the popover it opens for writing to the team.
 *
 * Two deliberate departures from the controls it sits beside:
 *
 * - It is *not* in the tool bar, so ADR-0011's fold-into-a-hamburger behaviour never
 *   reaches it — a visitor on a narrow window is exactly the one with something to say.
 * - It opens a popover with no backdrop, unlike QuestionnaireModal: the workspace behind
 *   stays usable, because a bug report is usually written while looking at the bug.
 *
 * It layers *below* the questionnaire modal (`z-50`) and the spotlight tour (`z-[60]`),
 * both of which are one-shot flows that must not be occluded by a permanent fixture.
 */
export default function FeedbackButton() {
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A failure that has been walked away from is stale — reopening must not greet the
  // visitor with the last attempt's alert. The typed body deliberately does survive:
  // dismissing the popover is not the same as throwing the message away.
  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  // The thank-you is a beat, not a screen: it shows, then takes the popover down with it
  // and leaves a blank form behind, so the next feedback never starts inside the last one.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setSent(false);
      setCategory("other");
      setBody("");
      setContact("");
    }, FEEDBACK_CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [sent, setOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || sending) return;

    setError(null);
    setSending(true);
    try {
      await submitFeedback({
        category,
        body,
        contact: contact.trim() || undefined,
        context: buildFeedbackContext(),
      });
      // Only the bucket reaches the study stream — never the prose (ADR-0014). Emitted
      // here rather than inside submitFeedback so a failed send logs nothing at all.
      logEvent("feedback_submitted", { category });
      setSent(true);
    } catch (caught) {
      // The body stays in state, so the message survives the failure and Send is live again.
      setError(caught instanceof FeedbackError ? caught.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={ref} className="fixed bottom-12 right-4 z-40">
      {open && (
        <div
          role="dialog"
          aria-label="Send feedback"
          className="absolute bottom-full right-0 mb-2 w-80 rounded-lg border border-[#D8D4C3] bg-white p-4 shadow-lg"
        >
          {sent ? (
            <p className="py-6 text-center text-sm font-medium text-[#52524F]">
              Thanks for the feedback!
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <fieldset>
                <legend className={labelStyle}>What kind of feedback is it?</legend>
                <div className="mt-1.5 space-y-1.5">
                  {CATEGORIES.map((choice) => (
                    <CategoryChoice
                      key={choice.value}
                      value={choice.value}
                      label={choice.label}
                      checked={category === choice.value}
                      onSelect={() => setCategory(choice.value)}
                    />
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="feedback-body" className={labelStyle}>
                  What would you like to tell us?
                </label>
                <textarea
                  id="feedback-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={FEEDBACK_BODY_MAX_LENGTH}
                  rows={4}
                  className={`${inputStyle} resize-none`}
                  placeholder="What happened, or what you'd like to see."
                />
              </div>

              <div>
                <label htmlFor="feedback-contact" className={labelStyle}>
                  How can we reach you? <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="feedback-contact"
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={FEEDBACK_CONTACT_MAX_LENGTH}
                  className={inputStyle}
                  placeholder="Email or however you prefer"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending || !body.trim()}
                className={primaryBtnStyle}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Feedback"
        title="Send us feedback"
        className="flex items-center gap-1.5 rounded-full border border-[#52524F] bg-[#52524F] px-4 py-2 text-sm font-medium text-white shadow-lg cursor-pointer transition-all hover:bg-[#3F3F3C] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M10 2c-4.418 0-8 2.91-8 6.5 0 1.98 1.09 3.75 2.81 4.93-.12.99-.54 2.04-1.3 2.9a.5.5 0 0 0 .48.83c1.8-.36 3.15-1.13 3.96-1.72.66.11 1.35.16 2.05.16 4.418 0 8-2.91 8-6.5S14.418 2 10 2Z" />
        </svg>
        Feedback
      </button>
    </div>
  );
}
