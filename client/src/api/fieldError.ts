/**
 * Mirrors the DRF `{"error": {field: [messages]}}` shape every analytics endpoint
 * returns on a 400 (see apps/analytics/views.py), so a form can show the server's own
 * wording — "This field may not be blank." — instead of a generic failure line.
 *
 * Returns null whenever the response isn't that shape (a 500, an HTML error page, a
 * body that never parses), leaving the caller's own fallback message to stand.
 */
export async function firstFieldError(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => ({}));
  const firstMessage = Object.values(body.error ?? {}).flat()[0];
  return typeof firstMessage === "string" ? firstMessage : null;
}
