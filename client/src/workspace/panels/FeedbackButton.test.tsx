import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FeedbackButton, { FEEDBACK_CONFIRMATION_MS } from "./FeedbackButton";
import * as feedbackApi from "../../api/feedback";
import { FeedbackError } from "../../api/feedback";
import * as logApi from "../../api/log";
import { useDocumentStore } from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";

beforeEach(() => {
  useDocumentStore.setState({ openDocuments: [], visibleDocumentIds: [], activeDocumentId: null });
  useWorkspaceStore.setState({ selectedWorkId: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function openPopover() {
  render(<FeedbackButton />);
  fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
}

function typeBody(text: string) {
  fireEvent.change(screen.getByLabelText(/what would you like to tell us/i), {
    target: { value: text },
  });
}

describe("FeedbackButton", () => {
  it("renders the trigger with the popover closed", () => {
    render(<FeedbackButton />);

    expect(screen.getByRole("button", { name: /feedback/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a popover with no backdrop over the workspace", () => {
    const { container } = render(<FeedbackButton />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // A full-screen layer would swallow clicks meant for the columns behind it — the
    // whole point of a popover here rather than the questionnaire's modal.
    expect(container.querySelector(".inset-0")).toBeNull();
  });

  it("closes on Escape", () => {
    openPopover();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a mousedown outside it", () => {
    openPopover();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the chosen category, the typed body and the context snapshot", async () => {
    const submit = vi.spyOn(feedbackApi, "submitFeedback").mockResolvedValue(undefined);
    openPopover();

    fireEvent.click(screen.getByRole("radio", { name: /bug/i }));
    typeBody("Retry re-runs the wrong search.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const submission = submit.mock.calls[0][0];
    expect(submission.category).toBe("bug");
    expect(submission.body).toBe("Retry re-runs the wrong search.");
    expect(submission.context).toMatchObject({ url: window.location.href });
  });

  it("defaults the category to other and sends an optional contact when given", async () => {
    const submit = vi.spyOn(feedbackApi, "submitFeedback").mockResolvedValue(undefined);
    openPopover();

    typeBody("A general remark.");
    fireEvent.change(screen.getByLabelText(/how can we reach you/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      category: "other",
      contact: "ada@example.com",
    });
  });

  it("disables the button and says Sending… while the request is in flight", async () => {
    let release: () => void = () => {};
    vi.spyOn(feedbackApi, "submitFeedback").mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    openPopover();

    typeBody("Something is off.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const sending = await screen.findByRole("button", { name: /sending/i });
    expect(sending).toBeDisabled();

    await act(async () => release());
  });

  it("cannot be submitted with an empty body", () => {
    const submit = vi.spyOn(feedbackApi, "submitFeedback").mockResolvedValue(undefined);
    openPopover();

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(submit).not.toHaveBeenCalled();
  });

  it("shows a thank-you in place of the form, then closes and resets", async () => {
    vi.spyOn(feedbackApi, "submitFeedback").mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openPopover();

    fireEvent.click(screen.getByRole("radio", { name: /bug/i }));
    typeBody("Retry re-runs the wrong search.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/thanks for the feedback/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what would you like to tell us/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(FEEDBACK_CONFIRMATION_MS);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reopened: a fresh form, back on the default category — not the last submission.
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByLabelText(/what would you like to tell us/i)).toHaveValue("");
    expect(screen.getByRole("radio", { name: /other/i })).toBeChecked();
  });

  it("shows the failure inline and keeps the typed body for a retry", async () => {
    vi.spyOn(feedbackApi, "submitFeedback").mockRejectedValue(
      new FeedbackError("Could not send. Please try again."),
    );
    openPopover();

    typeBody("Retry re-runs the wrong search.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not send/i);
    expect(screen.getByLabelText(/what would you like to tell us/i)).toHaveValue(
      "Retry re-runs the wrong search.",
    );
    expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
  });

  it("emits one feedback_submitted event carrying only the category", async () => {
    vi.spyOn(feedbackApi, "submitFeedback").mockResolvedValue(undefined);
    const logEvent = vi.spyOn(logApi, "logEvent").mockImplementation(() => {});
    openPopover();

    fireEvent.click(screen.getByRole("radio", { name: /feature/i }));
    typeBody("A slider for the window size would help.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(logEvent).toHaveBeenCalledTimes(1));
    expect(logEvent).toHaveBeenCalledWith("feedback_submitted", { category: "feature" });
  });

  it("emits nothing when the submission fails", async () => {
    vi.spyOn(feedbackApi, "submitFeedback").mockRejectedValue(new FeedbackError("nope"));
    const logEvent = vi.spyOn(logApi, "logEvent").mockImplementation(() => {});
    openPopover();

    typeBody("Something is off.");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByRole("alert");
    expect(logEvent).not.toHaveBeenCalled();
  });
});
