import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuestionnaireModal from "./QuestionnaireModal";
import { useAuthStore } from "../../store/authStore";
import * as questionnaireApi from "../../api/questionnaire";
import { QuestionnaireError } from "../../api/questionnaire";

const USER = { id: 1, email: "visitor@example.com" };
const DEFINITION = {
  version: 1,
  questions: [{ id: "purpose", prompt: "What is your main purpose this time?", type: "text" }],
};

beforeEach(() => {
  useAuthStore.setState({
    status: "authenticated",
    user: USER,
    promptDismissed: false,
    questionnaireResolved: false,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("QuestionnaireModal", () => {
  it("renders nothing for an anonymous visitor", () => {
    useAuthStore.setState({ status: "anonymous", user: null });

    const { container } = render(<QuestionnaireModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the session probe is still out", () => {
    useAuthStore.setState({ status: "unknown", user: null });

    const { container } = render(<QuestionnaireModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once this session's questionnaire has already been resolved", () => {
    useAuthStore.setState({ questionnaireResolved: true });

    const { container } = render(<QuestionnaireModal />);

    expect(container).toBeEmptyDOMElement();
  });

  it("fetches and shows the question set for a signed-in visitor who hasn't answered yet", async () => {
    vi.spyOn(questionnaireApi, "fetchQuestionnaire").mockResolvedValue(DEFINITION);

    render(<QuestionnaireModal />);

    expect(await screen.findByLabelText(/what is your main purpose/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits the typed answers and closes once saved", async () => {
    vi.spyOn(questionnaireApi, "fetchQuestionnaire").mockResolvedValue(DEFINITION);
    vi.spyOn(questionnaireApi, "submitQuestionnaireAnswers").mockResolvedValue(undefined);

    render(<QuestionnaireModal />);
    const field = await screen.findByLabelText(/what is your main purpose/i);
    fireEvent.change(field, { target: { value: "checking a passage" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(questionnaireApi.submitQuestionnaireAnswers).toHaveBeenCalledWith({
        purpose: "checking a passage",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("skip records a skipped response and closes the modal", async () => {
    vi.spyOn(questionnaireApi, "fetchQuestionnaire").mockResolvedValue(DEFINITION);
    vi.spyOn(questionnaireApi, "skipQuestionnaire").mockResolvedValue(undefined);

    render(<QuestionnaireModal />);
    await screen.findByLabelText(/what is your main purpose/i);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => expect(questionnaireApi.skipQuestionnaire).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("skip stays usable even when the question set failed to load", async () => {
    vi.spyOn(questionnaireApi, "fetchQuestionnaire").mockRejectedValue(new Error("network"));
    vi.spyOn(questionnaireApi, "skipQuestionnaire").mockResolvedValue(undefined);

    render(<QuestionnaireModal />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => expect(questionnaireApi.skipQuestionnaire).toHaveBeenCalled());
  });

  it("shows the server's message when submitting fails", async () => {
    vi.spyOn(questionnaireApi, "fetchQuestionnaire").mockResolvedValue(DEFINITION);
    vi.spyOn(questionnaireApi, "submitQuestionnaireAnswers").mockRejectedValue(
      new QuestionnaireError("Could not save. Please try again."),
    );

    render(<QuestionnaireModal />);
    await screen.findByLabelText(/what is your main purpose/i);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
