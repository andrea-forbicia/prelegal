"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AuthGate } from "./AuthGate";
import { useAuth } from "./AuthProvider";
import { Logo } from "./ui";

const NAV = [
  { href: "/", label: "New document" },
  { href: "/documents/", label: "My documents" },
];

function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape (focus back on the button) or a click outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut().catch(console.error);
    router.replace("/login/");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold uppercase text-white"
          aria-hidden="true"
        >
          {user?.email.charAt(0)}
        </span>
        <span className="hidden max-w-48 truncate sm:inline">{user?.email}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <p className="truncate border-b border-slate-100 px-4 py-2 text-xs text-brand-gray">
            Signed in as
            <span className="block truncate text-sm text-slate-800">{user?.email}</span>
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The frame of every signed-in page: top bar with navigation and account
 * menu, and a footer. Signed-out users are sent to /login/.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Prelegal home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || pathname === href.replace(/\/$/, "");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-navy/5 text-brand-navy shadow-[inset_0_-2px_0_var(--color-brand-accent)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-slate-600 sm:px-6">
          <span>© Prelegal. Drafts only: not legal advice.</span>
          <span>
            Templates by{" "}
            <a href="https://commonpaper.com" target="_blank" rel="noreferrer" className="underline hover:text-slate-700">
              Common Paper
            </a>
            , licensed under CC BY 4.0.
          </span>
        </div>
      </footer>
    </div>
  );
}
