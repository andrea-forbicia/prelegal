import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { authErrorMessage, getMe, signIn, signOut, signUp, validateCredentials, validateSignUp } from "./auth";

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth calls", () => {
  it("getMe returns the user, or null without a session", async () => {
    stubFetch(200, { id: 1, email: "a@b.co" });
    await expect(getMe()).resolves.toEqual({ id: 1, email: "a@b.co" });

    stubFetch(401, { detail: "Not authenticated" });
    await expect(getMe()).resolves.toBeNull();

    stubFetch(500, {});
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
  });

  it.each([
    ["signIn", signIn, "/api/auth/signin"],
    ["signUp", signUp, "/api/auth/signup"],
  ] as const)("%s posts the credentials", async (_name, call, url) => {
    const fetchMock = stubFetch(200, { id: 1, email: "a@b.co" });

    await call("a@b.co", "correct horse");

    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ email: "a@b.co", password: "correct horse" }),
    });
  });

  it("signOut posts and expects no content", async () => {
    const fetchMock = stubFetch(204);
    await expect(signOut()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signout");
  });
});

describe("validation", () => {
  it.each([
    ["not-an-email", "correct horse", "Enter a valid email address."],
    ["a@b.co", "short", "Your password must have at least 8 characters."],
    ["a@b.co", "x".repeat(129), "Your password can have at most 128 characters."],
    [" a@b.co ", "correct horse", null],
  ])("validateCredentials(%s, …)", (email, password, expected) => {
    expect(validateCredentials(email, password)).toBe(expected);
  });

  it("validateSignUp also checks the confirmation", () => {
    expect(validateSignUp("a@b.co", "correct horse", "correct horse")).toBeNull();
    expect(validateSignUp("a@b.co", "correct horse", "correct hose")).toBe("The passwords don't match.");
    expect(validateSignUp("bad", "correct horse", "other")).toBe("Enter a valid email address.");
  });

  it.each([
    [new ApiError("Invalid email or password", 401), "Incorrect email or password."],
    [new ApiError("Email already registered", 409), "An account with this email already exists. Sign in instead."],
    [new ApiError("x", 422), "Enter a valid email and a password of at least 8 characters."],
    [new ApiError("Could not reach the server.", 0), "Could not reach the server."],
    [new Error("boom"), "Something went wrong. Please try again."],
  ])("authErrorMessage maps %s", (err, expected) => {
    expect(authErrorMessage(err)).toBe(expected);
  });
});
