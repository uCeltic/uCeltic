/**
 * The two toolbar breakpoints from ADR-0011 (desktop-only responsive scope).
 *
 * Wide (≥ xl, 1280px)      → toolbar controls show text labels.
 * Below xl                 → controls render icon-only with tooltips.
 * Narrower still (< lg)     → the IIIF Manuscript panel auto-hides.
 *
 * The text→icon swap is pure CSS: controls carry Tailwind's `xl:` variants, so
 * there is nothing to configure here for it — this file is the JS-side companion,
 * holding the query the layout listens on to auto-hide the IIIF panel. Keep the
 * `lg`/`xl` values here in step with the Tailwind classes used in the toolbar.
 */

// Tailwind's `lg` breakpoint is 1024px; the panel hides once the viewport is below it.
export const IIIF_AUTOHIDE_QUERY = "(max-width: 1023px)";
