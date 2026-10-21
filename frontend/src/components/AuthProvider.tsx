"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "@/lib/api";
import * as auth from "@/lib/auth";

type AuthState = {
  status: "loading" | "anonymous" | "authenticated";
  user: auth.User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Who is signed in, checked once per page load with GET /api/auth/me. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<auth.User | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  const adopt = useCallback((next: auth.User | null) => {
    setUser(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    // Any API call answered with 401 means the session is gone.
    setUnauthorizedHandler(() => adopt(null));
    auth
      .getMe()
      .then(adopt)
      .catch((err) => {
        console.error(err);
        adopt(null);
      });
    return () => setUnauthorizedHandler(null);
  }, [adopt]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      signIn: async (email, password) => adopt(await auth.signIn(email, password)),
      signUp: async (email, password) => adopt(await auth.signUp(email, password)),
      signOut: async () => {
        try {
          await auth.signOut();
        } finally {
          adopt(null);
        }
      },
    }),
    [status, user, adopt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
