/**
 * Client for the AI chat that picks and drafts a document (`POST /api/chat`).
 * The backend is stateless: every turn sends the conversation and the current
 * draft (null before a document is chosen), and returns the assistant's reply
 * and the updated draft, which may be a different document after a switch.
 */

import type { Draft } from "./documents";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatTurn = { reply: string; document: Draft | null };

/** The opening message, shown before the user has typed anything. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    // The documents themselves are listed next to the chat, from documents.json.
    "Hi! I'm Prelegal's drafting assistant. Tell me what you're trying to do and I'll suggest the right agreement, or pick a document from the list.",
};

// Mirror MAX_MESSAGES and MAX_MESSAGE_LENGTH in backend/app/chat.py.
/** Older messages are dropped; the draft already holds the facts they gave. */
export const MAX_HISTORY = 40;
export const MAX_MESSAGE_LENGTH = 4000;

/** An error whose message can be shown to the user as is. */
export class ChatError extends Error {}

function errorMessage(status: number): string {
  if (status === 502) return "The assistant is unavailable right now. Please try again.";
  if (status === 422) return "That message could not be sent. Please try a shorter one.";
  return "Something went wrong. Please try again.";
}

function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const { id, form } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof form !== "object" || form === null) return false;
  const { parties } = form as Record<string, unknown>;
  return Array.isArray(parties) && parties.length === 2;
}

function isChatTurn(body: unknown): body is ChatTurn {
  if (typeof body !== "object" || body === null) return false;
  const { reply, document } = body as Record<string, unknown>;
  return typeof reply === "string" && (document === null || isDraft(document));
}

export async function sendChat(
  messages: ChatMessage[],
  document: Draft | null,
  today: string,
  signal?: AbortSignal,
): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), document, today }),
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
