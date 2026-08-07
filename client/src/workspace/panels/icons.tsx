/**
 * Small inline toolbar icons (the repo ships no icon library). They surface when a
 * control collapses to icon-only — in stages, at `xl` or at `lg` (ADR-0011/0020), so
 * for most controls the glyph is what the reader normally sees.
 *
 * All are 16×16 line icons drawn in `currentColor` and marked `aria-hidden`: the
 * accessible name comes from the button's own label/tooltip, never the glyph. In
 * particular the Manuscript control pairs {@link BookIcon} (a physical book) with
 * the word "Manuscripts" and must never be renamed "Books"; the Works opener
 * uses {@link LayersIcon} so the physical original and the digitized texts that
 * carry a Work read as distinct kinds of source.
 */
type IconProps = { className?: string };

const base = "h-4 w-4 shrink-0";

function Svg({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? base}
    >
      {children}
    </svg>
  );
}

// Tag Filter — a luggage-style tag with its punch hole.
export function TagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Scope (Works) — stacked layers, i.e. a container grouping its Versions.
export function LayersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Svg>
  );
}

// Add Text — a document with a plus.
export function FilePlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </Svg>
  );
}


// Advanced search parameters — sliders.
export function SlidersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="7" cy="16" r="2" />
    </Svg>
  );
}

// Search — a magnifying glass.
export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

/**
 * Search, in flight — the magnifier's slot while a column is still searching.
 *
 * A three-quarter ring, spun by `animate-spin`. It replaces the icon rather than
 * sitting beside it so the button's width never changes mid-search, and it is what
 * carries the busy state at *every* width: the label that used to flicker to "..."
 * was invisible below the collapse breakpoint, which is most of the time (#174).
 *
 * `motion-reduce:animate-none` stops the spin for a reader who asked for less
 * motion; the button's `aria-busy` and its `disabled` state say the same thing
 * without it.
 */
export function SpinnerIcon({ className }: IconProps) {
  return (
    <Svg className={`${className ?? base} animate-spin motion-reduce:animate-none`}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  );
}

// Manuscript — a physical book. Distinct from LayersIcon (Works, i.e. digitized
// texts); never "Books".
export function BookIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
    </Svg>
  );
}
