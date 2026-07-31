import { csrfHeaders, ensureCsrfToken } from "./csrf";
import { firstFieldError } from "./fieldError";
import { getSessionId } from "./log";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const QUESTIONNAIRE_URL = `${API_BASE}/questionnaire/`;

export interface Question {
  id: string;
  prompt: string;
  type: string;
}

export interface QuestionnaireDefinition {
  version: number;
  questions: Question[];
}

/** A rejected questionnaire request — open to any visitor (ADR-0007), so this should be rare. */
export class QuestionnaireError extends Error {}

/** Open to guests too (ADR-0007) — same-origin credentials so a signed-in visitor's session still rides along. */
export async function fetchQuestionnaire(): Promise<QuestionnaireDefinition> {
  const response = await fetch(QUESTIONNAIRE_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new QuestionnaireError("Could not load the questionnaire.");
  }
  return response.json();
}

async function submit(body: { skipped: boolean; answers?: Record<string, unknown> }): Promise<void> {
  await ensureCsrfToken();

  const response = await fetch(QUESTIONNAIRE_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ session_id: getSessionId(), ...body }),
  });

  if (!response.ok) {
    throw new QuestionnaireError((await firstFieldError(response)) ?? "Could not save. Please try again.");
  }
}

export function submitQuestionnaireAnswers(answers: Record<string, unknown>): Promise<void> {
  return submit({ skipped: false, answers });
}

export function skipQuestionnaire(): Promise<void> {
  return submit({ skipped: true });
}
