import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNdaForm } from "./cover-page";
import { ChatError, GREETING, MAX_HISTORY, sendNdaChat, type ChatMessage } from "./nda-chat";

const form = defaultNdaForm("2026-10-21");
const history: ChatMessage[] = [GREETING, { role: "user", content: "Acme and Globex" }];

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, body: JSON.parse(init.body as string) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendNdaChat", () => {
  it("posts the conversation, form and date, and returns the turn", async () => {
    const updated = { ...form, governingLaw: "Delaware" };
    const fetchMock = stubFetch(jsonResponse({ reply: "Noted.", form: updated }));

    const turn = await sendNdaChat(history, form, "2026-10-21");

    expect(turn).toEqual({ reply: "Noted.", form: updated });
    const { url, init, body } = sentBody(fetchMock);
    expect(url).toBe("/api/chat/nda");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ messages: history, form, today: "2026-10-21" });
  });

  it(`sends at most the last ${MAX_HISTORY} messages`, async () => {
    const long: ChatMessage[] = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `message ${i}`,
    }));
    const fetchMock = stubFetch(jsonResponse({ reply: "Ok", form }));

    await sendNdaChat(long, form, "2026-10-21");

    const { body } = sentBody(fetchMock);
    expect(body.messages).toHaveLength(MAX_HISTORY);
    expect(body.messages.at(-1)).toEqual(long.at(-1));
  });

  it.each([
    [502, "The assistant is unavailable right now. Please try again."],
    [422, "That message could not be sent. Please try a shorter one."],
    [500, "Something went wrong. Please try again."],
  ])("maps HTTP %i to a readable error", async (status, message) => {
    stubFetch(jsonResponse({ detail: "internal" }, status));
    const result = sendNdaChat(history, form, "2026-10-21");
    await expect(result).rejects.toThrow(ChatError);
    await expect(result).rejects.toThrow(message);
  });

  it.each([
    ["not JSON", new Response("<html>", { status: 200 })],
    ["missing reply", jsonResponse({ form })],
    ["missing form", jsonResponse({ reply: "Hi" })],
    ["wrong party count", jsonResponse({ reply: "Hi", form: { ...form, parties: [] } })],
  ])("rejects a malformed response (%s)", async (_case, response) => {
    stubFetch(response);
    await expect(sendNdaChat(history, form, "2026-10-21")).rejects.toThrow(ChatError);
  });

  it("reports network failures", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await expect(sendNdaChat(history, form, "2026-10-21")).rejects.toThrow(
      "Could not reach the server",
    );
  });

  it("rethrows aborts unchanged", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    stubFetch(abort);
    await expect(sendNdaChat(history, form, "2026-10-21", controller.signal)).rejects.toBe(abort);
  });
});

describe("GREETING", () => {
  it("is an assistant message", () => {
    expect(GREETING.role).toBe("assistant");
    expect(GREETING.content).toMatch(/Mutual Non-Disclosure Agreement/);
  });
});
