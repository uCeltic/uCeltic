/**
 * What the workspace does with a shrunk window — the JS-side half of the
 * desktop-only responsive scope (ADR-0011, extended to the columns by ADR-0019).
 *
 * The tool bar has two breakpoints:
 *
 * Wide (≥ xl, 1280px)      → toolbar controls show text labels.
 * Below xl                 → controls render icon-only with tooltips.
 * Narrower still (< lg)     → the IIIF Manuscript panel auto-hides.
 *
 * The text→icon swap is pure CSS: controls carry Tailwind's `xl:` variants, so
 * there is nothing to configure here for it — the query below is what the layout
 * listens on to auto-hide the IIIF panel. Keep the `lg`/`xl` values here in step
 * with the Tailwind classes used in the toolbar.
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
