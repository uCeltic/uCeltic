// How the manuscript renders a stretch of text, as recorded in `@rend`. Shared
// by every element that carries one, so `@rend` means the same thing wherever
// it appears.
//
// `italic` and `ital` are both live in the built-in corpus (438 and 31 uses),
// as are `superscript` and `large`; `decor` marks a decorated initial and comes
// from the research manuscripts rather than from `backend/tei/`. Anything else
// renders as plain text: an unrecognised rendition is still readable text, and
// guessing at it would misrepresent the manuscript.
const REND_CLASSES: Record<string, string> = {
  decor: "text-3xl leading-none font-semibold text-red-800",
  italic: "italic",
  ital: "italic",
  superscript: "align-super text-xs",
  large: "text-lg",
};

/**
 * The classes one `@rend` asks for.
 *
 * `@rend` is a space-separated token *list*, not a single value — this corpus
 * carries `rend="italic center"` and `rend="italic rightJustified"` as readily
 * as `rend="italic"` — so it is matched token by token. Matching the whole
 * string would drop every compound rendition on the floor, silently.
 */
export function rendClasses(rend: string | undefined): string[] {
  return (rend ?? "")
    .split(/\s+/)
    .map((token) => REND_CLASSES[token])
    .filter(Boolean);
}
