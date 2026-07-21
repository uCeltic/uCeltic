import { useCallback, useState } from "react";
import { AuthError } from "../../api/auth";

/**
 * The submit half of an /account form: the in-flight flag, and the one way this app
 * reports a failed auth call — the server's own wording when it sent any, the caller's
 * fallback otherwise (#81).
 *
 * Owning the try/catch in one place is the point. Every form here reaches the same API
 * surface, where *any* non-200/401 is a failure (see `call()` in api/auth.ts): a
 * rate-limited 429 is as real a rejection as a 400, and a page that quietly treated one
 * as success would send the visitor off to wait for an email that was never sent.
 */
export function useAuthSubmit(fallbackMessage: string) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Run one submit. Note that success deliberately leaves `submitting` set: every caller
   * either navigates away or swaps in a "done" view, so re-arming the button would only
   * offer a second submit of a request that already went through.
   */
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      setSubmitting(true);

      try {
        await action();
      } catch (caught) {
        setError(caught instanceof AuthError ? caught.message : fallbackMessage);
        setSubmitting(false);
      }
    },
    [fallbackMessage],
  );

  return { error, submitting, run, clearError };
}
