import type { TEIElementProps } from "../elementMap";

export function Choice({ children }: TEIElementProps) {
  return <span data-tei-tag="choice">{children}</span>;
}

// hidden inside <choice> — expan takes over
export function Abbr({ node, children }: TEIElementProps) {
  return (
    <abbr className="hidden" title={node.attrs?.type} data-tei-tag="abbr">
      {children}
    </abbr>
  );
}

export function Expan({ children }: TEIElementProps) {
  return <span data-tei-tag="expan">{children}</span>;
}

export function Ex({ children }: TEIElementProps) {
  return (
    <span className="italic text-gray-500" data-tei-tag="ex">
      {children}
    </span>
  );
}

export function Sic({ children }: TEIElementProps) {
  return (
    <span
      className="underline decoration-red-400 decoration-wavy"
      data-tei-tag="sic"
      title="sic"
    >
      {children}
    </span>
  );
}

export function Corr({ children }: TEIElementProps) {
  return <span data-tei-tag="corr">{children}</span>;
}

// critical apparatus — passthrough, lem/rdg handle visibility
export function App({ children }: TEIElementProps) {
  return <span data-tei-tag="app">{children}</span>;
}

export function Lem({ children }: TEIElementProps) {
  return <span data-tei-tag="lem">{children}</span>;
}

// variant reading — hidden by default
export function Rdg({ node, children }: TEIElementProps) {
  return (
    <span className="hidden" data-tei-tag="rdg" data-tei-wit={node.attrs?.wit}>
      {children}
    </span>
  );
}

export function Note({ children }: TEIElementProps) {
  return (
    <span className="group relative inline-block" data-tei-tag="note">
      <sup className="cursor-help select-none text-xs text-blue-500">*</sup>
      <span
        className="pointer-events-none absolute bottom-full left-0 z-10 hidden w-48 rounded
          bg-gray-800 p-2 text-xs leading-4 text-white shadow-lg group-hover:block"
      >
        {children}
      </span>
    </span>
  );
}

export function HandShift() {
  return null;
}
