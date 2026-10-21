# prelegal
A platform for drafting common legal agreements

> **Status:** 🚧 Work in progress. The project is under active development and is expected to be completed by **October 27, 2026**.

## Running Prelegal

Prelegal runs as a single Docker container: FastAPI serves the JSON API under `/api` and the statically exported Next.js frontend at `/`.

1. Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`.
2. Start and stop with the script for your platform (on Windows, use Git Bash):

   ```bash
   scripts/start-mac.sh      # or start-linux.sh / start-windows.sh
   scripts/stop-mac.sh       # or stop-linux.sh / stop-windows.sh
   ```

The app is available at http://localhost:8000/. The SQLite database lives inside the container and is recreated from scratch every time it starts.

## Development

| Area | Location | Commands |
|------|----------|----------|
| Backend (FastAPI, uv) | `backend/` | `uv run pytest` · `uv run uvicorn app.main:create_app --factory --reload --env-file ../.env` |
| Frontend (Next.js) | `frontend/` | `npm test` · `npm run lint` · `npm run dev` (proxies `/api` to the backend on port 8000) · `npm run build` (static export to `out/`) |

### Backend API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/signup` | Create an account (`{email, password}`) and sign in |
| `POST` | `/api/auth/signin` | Sign in and receive an HttpOnly session cookie |
| `POST` | `/api/auth/signout` | End the current session |
| `GET` | `/api/auth/me` | The signed-in user |

Backend settings come from environment variables: `DATABASE_PATH`, `STATIC_DIR`, `SESSION_TTL_HOURS`, `COOKIE_SECURE`, `OPENROUTER_API_KEY` and `LLM_MODEL` (optional override of the default OpenRouter model).

The UI is still the Mutual NDA Creator prototype: sign-in and AI chat screens will build on this API and on the LLM client in `backend/app/llm.py`.
