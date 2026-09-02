/**
 * The four tuning knobs a search runs with, and the one place their UI names become
 * their wire names.
 *
 * Two things have to send them: the `search_performed` Behavior Event and a Search
 * History entry. Both spelled the renaming out for themselves, and one of them owned a
 * conversion CONTEXT.md is emphatic about — "Match Length" is a percentage on screen and
 * `window_size_ratio` everywhere else, so `130` on the slider is `1.3` on the wire (#19,
 * #120). A second copy of that `/ 100` is a second place for the layers to drift apart.
 */
export interface SearchParams {
  matchLength: number;
  precision: number;
  dissimilarityScore: number;
  topK: number;
}

export interface SearchWireParams {
  window_size_ratio: number;
  step_size: number;
  dissimilarity_threshold: number;
  top_k: number;
}

export function toWireParams(params: SearchParams): SearchWireParams {
  return {
    window_size_ratio: params.matchLength / 100,
    step_size: params.precision,
    dissimilarity_threshold: params.dissimilarityScore,
    top_k: params.topK,
  };
}
