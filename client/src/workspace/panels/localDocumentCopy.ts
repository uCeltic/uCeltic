/**
 * What the workspace says about a **Local Document** — a file a visitor opens
 * from their own machine, added client-side, never uploaded and never stored
 * (CONTEXT.md → Local Document).
 *
 * One fact, stated three times because each moment is the useful one for a
 * different reader (#175): before a file is picked, for as long as its column
 * is open, and — by saying nothing at all — after a search. The words live
 * together here because that is what stops a later change from fixing one
 * surface and leaving the others claiming the opposite.
 *
 * None of them may say **"upload"**: the file never reaches a server, and the
 * word would tell visitors the reverse of the best property the feature has.
 */

/** The limit itself, in the second person, as a clause the sentences share. */
const READING_ONLY_CLAUSE =
  "files you open from your machine are for reading only; they stay in your browser and are not searchable";

/**
 * The `Add Text` tooltip — the earliest of the three, and the only one that
 * arrives while the visitor can still choose a different file.
 *
 * It leads with the button's own words so the tooltip still names the control
 * it belongs to. The button's `aria-label` stays `Add Text`, so this sentence
 * never becomes its accessible name.
 */
export const ADD_TEXT_TITLE = `Add Text — ${READING_ONLY_CLAUSE}.`;

/** The chip beside a Local Document column's title. */
export const READING_ONLY_LABEL = "Reading only";

/**
 * The chip's own tooltip. Two words are enough to mark the column, but not to
 * explain it — and at the column's floor width even those two can clip.
 */
export const READING_ONLY_TITLE = `This file was opened from your machine: ${READING_ONLY_CLAUSE}.`;
