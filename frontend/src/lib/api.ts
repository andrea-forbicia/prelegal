/**
 * A small JSON client for the backend API (same origin, session cookie).
 * A 401 from any call notifies the registered handler, so the auth state can
 * drop the user and the guard can send them to the sign-in page.
 */

/** An API error whose message can be shown to the user as is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers what to do when the session is missing or has expired. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}

function defaultMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 404) return "Not found.";
  return "Something went wrong. Please try again.";
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

/** Returns the parsed JSON body, or undefined for an empty (204) response. */
export async function apiFetch<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized();
    const payload: unknown = await response.json().catch(() => null);
    const detail = (payload as { detail?: unknown } | null)?.detail;
    // Validation errors (422) carry a list of issues, not a message.
    throw new ApiError(typeof detail === "string" ? detail : defaultMessage(response.status), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
