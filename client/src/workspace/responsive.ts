/**
 * What the workspace does with a shrunk window — the JS-side half of the
 * desktop-only responsive scope (ADR-0011, extended to the columns by ADR-0019).
 *
 * The tool bar has three tiers. Labels do not all go at once: each collapses at the
 * width where it stops earning its space, which is not the same width for all of them
 * (ADR-0020).
 *
 * Wide (≥ xl, 1280px)      → every toolbar control shows its text label.
 * Below xl                 → Manuscripts, Add Text and Advanced go icon-only: their
 *                            labels repeat their glyph and their own pressed state.
 * Narrower still (< lg)     → Tags, Works and Search follow — the Tag Filter and Works
 *                            labels name the *selected* entity and work, so they are
 *                            the last thing the bar gives up — and the IIIF Manuscript
 *                            panel auto-hides.
 *
 * The text→icon swap is pure CSS: labels carry Tailwind's `xl:`/`lg:` variants from
 * `buttonStyles.ts`, so there is nothing to configure here for it — the query below is
 * what the layout listens on to auto-hide the IIIF panel. Keep the `lg`/`xl` values
 * here in step with the Tailwind classes used in the toolbar.
 *
 * The document area below it answers to no breakpoint at all: the columns take a
 * floor and the strip scrolls, at every width alike.
 */

// Tailwind's `lg` breakpoint is 1024px; the panel hides once the viewport is below it.
export const IIIF_AUTOHIDE_QUERY = "(max-width: 1023px)";

/**
 * The floor a text-viewer column is never squeezed below (ADR-0019).
 *
 * Columns split the document area evenly while they all fit; once the total
 * would push any of them under this width they stop shrinking and the column
 * strip scrolls sideways instead.
 *
 * The number is a judgement, not a measurement. A column's own controls need
 * about 240px of it — the header's 160px title button plus the ✕, and the
 * result card's counter plus its ←/→ — and those are what a collapsing column
 * loses first (#159). The rest is the margin that keeps the text under them
 * worth reading, which is the only reason to keep the column open.
 *
 * Applied as an inline `min-width` rather than a Tailwind class so this one
 * value is what the layout, the tests and the ADR all talk about.
 */
export const COLUMN_MIN_WIDTH_PX = 320;
