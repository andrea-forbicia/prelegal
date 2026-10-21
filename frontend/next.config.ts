import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Production builds are a static export (out/) served by the FastAPI backend.
// `next dev` proxies /api to a locally running backend so cookies stay
// same-origin, as they are in production.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
      },
    };
  }
  return {
    output: "export",
    // Emits page/index.html, which FastAPI's StaticFiles serves for /page/.
    trailingSlash: true,
  };
}
