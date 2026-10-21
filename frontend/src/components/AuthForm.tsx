"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, authErrorMessage, validateCredentials, validateSignUp } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { Alert, Button, Field, Loading, Logo, Spinner } from "./ui";

type Mode = "signin" | "signup";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "signin", label: "Sign in" },
  { mode: "signup", label: "Create account" },
];

/** The sign-in and sign-up page: one card, two tabs. */
export function AuthForm() {
  const { status, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signed in already (or just now): go to the editor.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  function switchTo(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem =
      mode === "signup" ? validateSignUp(email, password, confirm) : validateCredentials(email, password);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await (mode === "signup" ? signUp : signIn)(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (status !== "anonymous") return <Loading />;

  const signingUp = mode === "signup";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold text-brand-navy">
            {signingUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-brand-gray">
            Draft NDAs, cloud service agreements and more with an AI assistant.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div role="group" aria-label="Account" className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {TABS.map(({ mode: tab, label }) => (
              <button
                key={tab}
                type="button"
                aria-pressed={mode === tab}
                onClick={() => switchTo(tab)}
                className={`rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === tab ? "bg-white text-brand-navy shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "auth-error" : undefined}
              required
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={[signingUp && "password-hint", error && "auth-error"].filter(Boolean).join(" ") || undefined}
              required
            />
            {signingUp && (
              <>
                <p id="password-hint" className="-mt-2 text-xs text-slate-600">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
                <Field
                  id="confirm"
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "auth-error" : undefined}
                  required
                />
              </>
            )}
            {error && <Alert id="auth-error">{error}</Alert>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Spinner />}
              {signingUp ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-600">
          Prelegal drafts documents with AI assistance. Drafts are not legal advice and should be
          reviewed by a qualified lawyer before use.
        </p>
      </div>
    </div>
  );
}
