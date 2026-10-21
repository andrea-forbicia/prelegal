"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Loading } from "./ui";

/** Renders its children for signed-in users and sends everyone else to /login/. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login/");
  }, [status, router]);

  // The pages are static, so nothing protected is shown until the check is done.
  if (status !== "authenticated") return <Loading />;
  return children;
}
