/**
 * The user's saved documents (`/api/documents`, backend/app/saved.py) and the
 * autosaver that keeps the open document saved after every change.
 */

import { ApiError, apiFetch } from "./api";
import type { ChatMessage } from "./chat";
import type { Draft } from "./documents";

// Mirrors MAX_SAVED_MESSAGES in backend/app/saved.py.
export const MAX_SAVED_MESSAGES = 200;

export type SavedSummary = {
  id: number;
  documentId: string;
  /** The document's name, e.g. "Pilot Agreement". */
  name: string;
  /** The parties' companies that are filled in. */
  companies: string[];
  /** ISO timestamp (UTC). */
  updatedAt: string;
};

export type SavedDocument = SavedSummary & { document: Draft; messages: ChatMessage[] };

/** What gets saved: the draft and the conversation that produced it. */
export type Snapshot = { document: Draft; messages: ChatMessage[] };

function body(snapshot: Snapshot) {
  return { document: snapshot.document, messages: snapshot.messages.slice(-MAX_SAVED_MESSAGES) };
}

export function listDocuments(): Promise<SavedSummary[]> {
  return apiFetch<SavedSummary[]>("/api/documents");
}

export function getDocument(id: number): Promise<SavedDocument> {
  return apiFetch<SavedDocument>(`/api/documents/${id}`);
}

export function createDocument(snapshot: Snapshot): Promise<SavedDocument> {
  return apiFetch<SavedDocument>("/api/documents", { method: "POST", body: body(snapshot) });
}

export function updateDocument(id: number, snapshot: Snapshot): Promise<SavedDocument> {
  return apiFetch<SavedDocument>(`/api/documents/${id}`, { method: "PUT", body: body(snapshot) });
}

export function deleteDocument(id: number): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}`, { method: "DELETE" });
}

/** e.g. "Acme Inc. and Globex", or a note when no company is filled in yet. */
export function formatCompanies(companies: string[]): string {
  if (companies.length === 0) return "No parties yet";
  return companies.join(" and ");
}

/** e.g. "Oct 21, 2026, 9:05 PM" in the user's locale and timezone. */
export function formatUpdated(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type AutosaverDeps = {
  create: (snapshot: Snapshot) => Promise<{ id: number }>;
  update: (id: number, snapshot: Snapshot) => Promise<unknown>;
  /** After each save; `id` is the saved document's id. */
  onSaved?: (id: number) => void;
  onStatus?: (status: SaveStatus) => void;
};

/**
 * Saves snapshots one at a time, in order. The first save creates the
 * document and later ones update it, so quick successive changes never create
 * duplicates. A snapshot that arrives while a save is running replaces any
 * one still waiting: only the latest state matters.
 */
export function createAutosaver({ create, update, onSaved, onStatus }: AutosaverDeps) {
  let id: number | null = null;
  // Bumped by reset(): a save that started for an earlier document must not
  // attach its id to the new one.
  let generation = 0;
  let running: Promise<void> | null = null;
  let queued: Snapshot | null = null;

  async function run(snapshot: Snapshot): Promise<void> {
    const started = generation;
    onStatus?.("saving");
    try {
      if (id !== null) {
        try {
          await update(id, snapshot);
        } catch (err) {
          // Deleted meanwhile (say, from My documents in another tab): save it anew.
          if (!(err instanceof ApiError && err.status === 404)) throw err;
          if (started === generation) id = null;
        }
        if (started !== generation) return;
      }
      if (id === null) {
        const created = await create(snapshot);
        if (started !== generation) return;
        id = created.id;
      }
      onSaved?.(id);
      if (!queued) onStatus?.("saved");
    } catch (err) {
      console.error(err);
      // The next change retries; a failed create leaves id null, so it creates again.
      if (started === generation) onStatus?.("error");
    }
  }

  async function drain(): Promise<void> {
    while (queued) {
      const next = queued;
      queued = null;
      await run(next);
    }
    running = null;
  }

  return {
    save(snapshot: Snapshot): void {
      queued = snapshot;
      running ??= drain();
    },
    /** Start a new document: the next save creates one. */
    reset(): void {
      generation += 1;
      id = null;
      queued = null;
      onStatus?.("idle");
    },
    /** Continue an existing saved document. */
    open(savedId: number): void {
      generation += 1;
      id = savedId;
      queued = null;
      onStatus?.("saved");
    },
    get id(): number | null {
      return id;
    },
    /** Resolves once every pending save has finished. */
    async flush(): Promise<void> {
      while (running) await running;
    },
  };
}

export type Autosaver = ReturnType<typeof createAutosaver>;
