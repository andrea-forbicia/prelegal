/** Small shared building blocks, so every screen looks the same. */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const BUTTON_VARIANTS = {
  // Purple for submit and main actions, as in CLAUDE.md.
  primary: "bg-brand-secondary text-white shadow-sm hover:bg-brand-secondary-dark",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

export function buttonClass(variant: keyof typeof BUTTON_VARIANTS = "primary"): string {
  return `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANTS[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return <button type="button" className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A full-area loading state. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-brand-gray">
      <Spinner className="h-5 w-5 text-brand-primary" />
      {label}
    </div>
  );
}

export function Alert({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Field({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        {...props}
      />
    </div>
  );
}

/** The Prelegal wordmark: a yellow accent bar and the name in navy. */
export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-brand-navy">
      <span className="h-5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
      Prelegal
    </span>
  );
}
