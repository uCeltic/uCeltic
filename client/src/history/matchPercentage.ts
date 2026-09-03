/**
 * Render a stored hit's score the way a reader understands it (ADR-0024).
 *
 * What the store holds is a *dissimilarity*: 0 is an identical passage and a larger
 * number is a worse match. Shown raw, every reading of it is backwards. So wherever a
 * Search History entry is read (#188) or exported (#190), the score becomes a similarity
 * — `(1 − score) × 100 %` — and a higher number reads as a closer match.
 *
 * Clamped at 0 because the score has no upper bound in the store: today the
 * dissimilarity threshold keeps it under 1, but a matcher that one day returned more
 * must not put a negative percentage in front of a reader.
 */
export function matchPercentage(score: number): string {
  return `${Math.round(Math.max(0, 1 - score) * 100)}%`;
}
