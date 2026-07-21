import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "react-router-dom";

/** Shared chrome for the six /account/* routes, in the workspace's palette. */
export default function AccountShell({
  title,
  subtitle,
  hideAccountLink,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  hideAccountLink?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0EEE6] px-4 py-10">
      <main className="w-full max-w-sm rounded-lg border border-[#D8D4C3] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#52524F]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#6B6B67]">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </main>

      {/* The workspace never depends on an account, so the way back is always open —
          unless the caller says otherwise. */}
      {!hideAccountLink && (
        <Link
          to="/workspace"
          className="mt-5 text-sm text-[#6B6B67] underline hover:text-[#52524F]"
        >
          Continue as a Visitor
        </Link>
      )}
    </div>
  );
}

export const label = "block text-sm font-medium text-[#52524F]";

/** Not exported: `Field` below is the only way an /account form gets an input (#81). */
const input =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#52524F] focus:ring-2 focus:ring-[#52524F]/20 transition-all";

export const primaryBtn =
  "w-full rounded-md border border-[#52524F] bg-[#52524F] px-3 py-2 text-sm font-medium text-white cursor-pointer transition-all hover:bg-[#3F3F3C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

export const link = "text-[#52524F] underline hover:text-[#3F3F3C]";

type FieldProps = {
  id: string;
  label: string;
  /** Spacing below the field; the last one before a submit button sits a little lower. */
  className?: string;
  /** Anything shown under the input — a hint, or this field's own validation message. */
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"input">, "id" | "className">;

/**
 * One labelled input. Declared once so a new /account form cannot drift into its own
 * label-to-input wiring — the `htmlFor`/`id` pair is what lets a screen reader (and the
 * component tests' `getByLabelText`) name the field at all (#81).
 */
export function Field({ id, label: text, className = "mb-4", children, ...rest }: FieldProps) {
  return (
    <div className={className}>
      <label className={label} htmlFor={id}>
        {text}
      </label>
      <input id={id} className={input} {...rest} />
      {children}
    </div>
  );
}

/** The server's own wording; `role="alert"` so a screen reader announces it on arrival. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
