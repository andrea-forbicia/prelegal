/** Sign up, sign in and session calls to /api/auth (backend/app/auth.py). */

import { ApiError, apiFetch } from "./api";

export type User = { id: number; email: string };

// Mirror the Credentials model in backend/app/auth.py.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** The signed-in user, or null when there is no valid session. */
export async function getMe(): Promise<User | null> {
  try {
    return await apiFetch<User>("/api/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function signIn(email: string, password: string): Promise<User> {
  return apiFetch<User>("/api/auth/signin", { method: "POST", body: { email, password } });
}

export function signUp(email: string, password: string): Promise<User> {
  return apiFetch<User>("/api/auth/signup", { method: "POST", body: { email, password } });
}

export function signOut(): Promise<void> {
  return apiFetch<void>("/api/auth/signout", { method: "POST" });
}

/** A message for the first problem with the sign-in details, or null. */
export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must have at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Your password can have at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validateSignUp(email: string, password: string, confirm: string): string | null {
  return validateCredentials(email, password) ?? (password === confirm ? null : "The passwords don't match.");
}

/** A friendlier message for a failed sign-in or sign-up. */
export function authErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  if (err.status === 401) return "Incorrect email or password.";
  if (err.status === 409) return "An account with this email already exists. Sign in instead.";
  if (err.status === 422) {
    return `Enter a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return err.message;
}
