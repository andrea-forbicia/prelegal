/**
 * Client for the AI chat that fills in the Mutual NDA (`POST /api/chat/nda`).
 * The backend is stateless: every turn sends the conversation and the current
 * form, and returns the assistant's reply and the updated form.
 */

import type { NdaForm } from "./cover-page";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatTurn = { reply: string; form: NdaForm };

/** The opening message, shown before the user has typed anything. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you draft a Mutual Non-Disclosure Agreement. To start, who are the two parties, and why will they share confidential information?",
};

// Mirror MAX_MESSAGES and MAX_MESSAGE_LENGTH in backend/app/chat.py.
/** Older messages are dropped; the form already holds the facts they gave. */
export const MAX_HISTORY = 40;
export const MAX_MESSAGE_LENGTH = 4000;

/** An error whose message can be shown to the user as is. */
export class ChatError extends Error {}

function errorMessage(status: number): string {
  if (status === 502) return "The assistant is unavailable right now. Please try again.";
  if (status === 422) return "That message could not be sent. Please try a shorter one.";
  return "Something went wrong. Please try again.";
}

function isChatTurn(body: unknown): body is ChatTurn {
  if (typeof body !== "object" || body === null) return false;
  const { reply, form } = body as Record<string, unknown>;
  return (
    typeof reply === "string" &&
    typeof form === "object" &&
    form !== null &&
    Array.isArray((form as Record<string, unknown>).parties) &&
    (form as { parties: unknown[] }).parties.length === 2
  );
}

export async function sendNdaChat(
  messages: ChatMessage[],
  form: NdaForm,
  today: string,
  signal?: AbortSignal,
): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat/nda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), form, today }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ChatError("Could not reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw new ChatError(errorMessage(response.status));

  const body: unknown = await response.json().catch(() => null);
  if (!isChatTurn(body)) throw new ChatError(errorMessage(response.status));
  return body;
}
