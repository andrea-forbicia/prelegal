import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { GREETING, type ChatMessage } from "./chat";
import { defaultNdaForm } from "./cover-page";
import type { Draft } from "./documents";
import {
  MAX_SAVED_MESSAGES,
  createAutosaver,
  createDocument,
  deleteDocument,
  formatCompanies,
  formatUpdated,
  getDocument,
  listDocuments,
  updateDocument,
  type SaveStatus,
  type Snapshot,
} from "./saved-documents";

const draft: Draft = { id: "mutual-nda", form: defaultNdaForm("2026-10-21") };
const snapshot = (text = "hi"): Snapshot => ({
  document: draft,
  messages: [GREETING, { role: "user", content: text }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved document calls", () => {
  function stubFetch(status = 200, body: unknown = {}) {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it.each([
    ["list", () => listDocuments(), "/api/documents", "GET"],
    ["get", () => getDocument(3), "/api/documents/3", "GET"],
    ["create", () => createDocument(snapshot()), "/api/documents", "POST"],
    ["update", () => updateDocument(3, snapshot()), "/api/documents/3", "PUT"],
  ] as const)("%s calls %s", async (_name, call, url, method) => {
    const fetchMock = stubFetch();
    await call();
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1].method).toBe(method);
  });

  it("delete expects no content", async () => {
    const fetchMock = stubFetch(204);
    await expect(deleteDocument(3)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("saves the draft and at most the latest messages", async () => {
    const fetchMock = stubFetch();
    const messages: ChatMessage[] = Array.from({ length: MAX_SAVED_MESSAGES + 10 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `message ${i}`,
    }));

    await createDocument({ document: draft, messages });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.document).toEqual(draft);
    expect(sent.messages).toHaveLength(MAX_SAVED_MESSAGES);
    expect(sent.messages.at(-1)).toEqual(messages.at(-1));
  });
});

describe("formatting", () => {
  it("joins the companies", () => {
    expect(formatCompanies([])).toBe("No parties yet");
    expect(formatCompanies(["Acme"])).toBe("Acme");
    expect(formatCompanies(["Acme", "Globex"])).toBe("Acme and Globex");
  });

  it("formats the update time", () => {
    expect(formatUpdated("2026-10-21T19:05:00Z", "en-US")).toMatch(/Oct 21, 2026/);
  });
});

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createAutosaver", () => {
  function setup() {
    const creates: { snapshot: Snapshot; done: ReturnType<typeof deferred<{ id: number }>> }[] = [];
    const updates: { id: number; snapshot: Snapshot; done: ReturnType<typeof deferred<unknown>> }[] = [];
    const statuses: SaveStatus[] = [];
    const saved: number[] = [];
    const saver = createAutosaver({
      create: (s) => {
        const done = deferred<{ id: number }>();
        creates.push({ snapshot: s, done });
        return done.promise;
      },
      update: (id, s) => {
        const done = deferred<unknown>();
        updates.push({ id, snapshot: s, done });
        return done.promise;
      },
      onSaved: (id) => saved.push(id),
      onStatus: (status) => statuses.push(status),
    });
    return { saver, creates, updates, statuses, saved };
  }

  // Lets the queued promise callbacks run.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("creates the document once, then updates it", async () => {
    const { saver, creates, updates, saved, statuses } = setup();

    saver.save(snapshot("one"));
    await tick();
    creates[0].done.resolve({ id: 7 });
    await tick();
    saver.save(snapshot("two"));
    await tick();
    updates[0].done.resolve({});
    await saver.flush();

    expect(creates).toHaveLength(1);
    expect(updates.map((u) => u.id)).toEqual([7]);
    expect(saver.id).toBe(7);
    expect(saved).toEqual([7, 7]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("sends only the latest of the changes made during a save", async () => {
    const { saver, creates, updates } = setup();

    saver.save(snapshot("one"));
    saver.save(snapshot("two"));
    saver.save(snapshot("three"));
    await tick();
    expect(creates).toHaveLength(1);
    creates[0].done.resolve({ id: 7 });
    await tick();
    updates[0].done.resolve({});
    await saver.flush();

    expect(creates).toHaveLength(1); // No duplicate document.
    expect(updates).toHaveLength(1);
    expect(updates[0].snapshot.messages.at(-1)?.content).toBe("three");
  });

  it("does not give a new document the id of one created before a reset", async () => {
    const { saver, creates, saved } = setup();

    saver.save(snapshot("old document"));
    await tick();
    saver.reset();
    saver.save(snapshot("new document"));
    creates[0].done.resolve({ id: 7 });
    await tick();
    creates[1].done.resolve({ id: 8 });
    await saver.flush();

    expect(creates).toHaveLength(2);
    expect(saver.id).toBe(8);
    expect(saved).toEqual([8]);
  });

  it("updates a document it was opened with", async () => {
    const { saver, creates, updates } = setup();

    saver.open(3);
    saver.save(snapshot());
    await tick();
    updates[0].done.resolve({});
    await saver.flush();

    expect(creates).toHaveLength(0);
    expect(updates[0].id).toBe(3);
  });

  it("saves a document deleted meanwhile as a new one", async () => {
    const { saver, creates, updates, saved } = setup();

    saver.open(3);
    saver.save(snapshot());
    await tick();
    updates[0].done.reject(new ApiError("Document not found", 404));
    await tick();
    creates[0].done.resolve({ id: 4 });
    await saver.flush();

    expect(saver.id).toBe(4);
    expect(saved).toEqual([4]);
  });

  it("reports a failure and retries on the next change", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { saver, creates, statuses } = setup();

    saver.save(snapshot("one"));
    await tick();
    creates[0].done.reject(new Error("offline"));
    await saver.flush();
    expect(statuses.at(-1)).toBe("error");
    expect(saver.id).toBeNull();

    saver.save(snapshot("two"));
    await tick();
    creates[1].done.resolve({ id: 9 });
    await saver.flush();
    expect(saver.id).toBe(9);
    expect(statuses.at(-1)).toBe("saved");
  });
});
