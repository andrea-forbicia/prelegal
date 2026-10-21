import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setUnauthorizedHandler } from "./api";

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe("apiFetch", () => {
  it("sends JSON with the session cookie and returns the parsed body", async () => {
    const fetchMock = stubFetch(jsonResponse({ id: 1 }, 201));

    const result = await apiFetch<{ id: number }>("/api/documents", { method: "POST", body: { a: 1 } });

    expect(result).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/documents");
    expect(init).toMatchObject({
      method: "POST",
      body: '{"a":1}',
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("sends a GET without a body", async () => {
    const fetchMock = stubFetch(jsonResponse([]));
    await apiFetch("/api/documents");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", body: undefined });
  });

  it("returns undefined for 204 No Content", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/documents/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("uses the server's message when it is a string", async () => {
    stubFetch(jsonResponse({ detail: "Document not found" }, 404));
    await expect(apiFetch("/api/documents/9")).rejects.toEqual(new ApiError("Document not found", 404));
  });

  it("falls back to a generic message for validation errors", async () => {
    stubFetch(jsonResponse({ detail: [{ msg: "bad" }] }, 422));
    await expect(apiFetch("/api/documents")).rejects.toEqual(
      new ApiError("Something went wrong. Please try again.", 422),
    );
  });

  it("tells the unauthorized handler about a 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(jsonResponse({ detail: "Not authenticated" }, 401));

    await expect(apiFetch("/api/documents")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("reports network failures and rethrows aborts", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/documents")).rejects.toMatchObject({ status: 0 });

    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    stubFetch(abort);
    await expect(apiFetch("/api/documents", { signal: controller.signal })).rejects.toBe(abort);
  });
});
