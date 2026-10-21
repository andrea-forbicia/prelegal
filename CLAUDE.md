# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

[@catalog.json](catalog.json)

The catalog lists 12 templates, which make 11 documents (the Mutual NDA Cover Page is part of the Mutual NDA). All 11 can be drafted via AI chat; they are defined in `documents.json` (see Technical design). Users sign up or sign in, and every draft is saved to their account ("My documents"). See "Current status" at the end of this file.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using GitHub tools

## AI design

When writing code to make calls to LLMs, use your cerebras skill to use LiteLLM via OpenRouter to the `openrouter/minimax/minimax-m3.1-flash:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document. 

There is an OPENROUTER_API_KEY in the .env file in project root.

## Technical design

The entire project is packaged into a single Docker container (multi-stage `Dockerfile` + `docker-compose.yml`).
The backend is in backend/ and is a uv project, using FastAPI.
The frontend is in frontend/ (Next.js, statically exported to `frontend/out` and served by FastAPI at `/`; the API lives under `/api`).
`documents.json` at the project root is the single registry of the documents Prelegal can draft and of their Cover Page fields; the backend reads it at runtime (`DOCUMENTS_PATH` overrides the path) and the frontend at build time, and the Dockerfile copies it into both stages.
The database uses SQLite and is created from scratch each time the app starts (`init_db` deletes and recreates it), with tables for users, sessions and saved documents.
There should be scripts in scripts/ for:
```bash
# Mac
scripts/start-mac.sh        # Start
scripts/stop-mac.sh         # Stop

# Linux
scripts/start-linux.sh      # Start
scripts/stop-linux.sh       # Stop

# Windows
scripts/start-windows.sh    # Start
scripts/stop-windows.sh     # Stop
```

Backend available at http://localhost:8000/

## Color Scheme
- Accent Yellow `#ecad0a`
- Blu Primary `#209dd7`
- Purple Secondary `#753991` (submit buttons)
- Dark Navy `#032147` (headings)
- Gray Text `#888888`

## Current status (as of 2026-10-21)

All Jira tickets (PL-2 → PL-7) are done and merged into `main` (last: PR #11); there are no open tickets.

Implemented so far:
- **Templates (PL-2):** 12 Common Paper templates in `templates/`, indexed by `catalog.json`.
- **Mutual NDA Creator (PL-3):** Next.js UI (`NdaPreview.tsx` / `NdaPdf.tsx` in `frontend/src/components`) with a form (replaced by AI chat in PL-5), live preview and PDF download (`@react-pdf/renderer`, Noto fonts in `frontend/public/fonts`). The standard terms are read from `templates/Mutual-NDA.md` at build time. Tests: Vitest (`npm test`).
- **V1 foundation (PL-4):**
  - FastAPI app factory `backend/app/main.py`: `/api/health`, JSON 404 for unknown `/api/*`, static frontend mounted at `/`.
  - Auth `backend/app/auth.py`: `POST /api/auth/signup`, `/signin`, `/signout`, `GET /api/auth/me`, using an HttpOnly session cookie. The `users` and `sessions` tables are in `backend/app/db.py`.
  - LLM client `backend/app/llm.py`: `complete_text` / `complete_structured` (Pydantic Structured Outputs) via LiteLLM → OpenRouter → Cerebras. `LLM_MODEL` overrides the model.
  - Settings via env (`backend/app/config.py`): `DATABASE_PATH`, `STATIC_DIR`, `SESSION_TTL_HOURS`, `COOKIE_SECURE`, `ALLOWED_ORIGINS` (PL-7).
  - Docker, plus start/stop scripts for mac/linux/windows (they need `.env`). Tests: pytest (`uv run pytest` in `backend/`).
- **AI chat for the Mutual NDA (PL-5):** the form was replaced by an AI chat next to the live preview (generalized in PL-6).
  - `backend/app/documents/nda.py`: `NdaForm` (camelCase JSON, the single validator), the `NdaUpdates` / `NdaChatTurn` structured-output schemas, the system prompt, and `apply_updates` (since PL-6 a thin wrapper around `common.merge_updates`), which drops invalid LLM values instead of failing the turn. The LLM gets and returns the effective date as `{year, month, day}` (`DateParts`), not an ISO string: as a string the model swapped day and month.
  - The `:free` MiniMax model is no longer served by Cerebras and its endpoint ignores `response_format`, so `complete_structured` also puts the JSON Schema in the prompt, extracts the JSON from the reply and retries once.
- **All document types (PL-6):**
  - `POST /api/chat` (`backend/app/chat.py`) is stateless and, since PL-7, for signed-in users only: each turn the browser sends `{messages, document, today}`, where `document` is `{id, form}` or null before one is chosen, and gets `{reply, document}` (502 if the LLM fails, 422 for invalid input or an unknown id; max 40 messages of 4000 chars). `/api/chat/nda` is gone.
  - With no document, a selection prompt (`documents/selection.py`) picks one, or explains that an unsupported document (e.g. an employment contract) can't be drafted and offers the closest one. With a document, its drafting prompt fills the fields and may return `switch_to`. On a choice or switch a second LLM call drafts the new document from the same conversation; the parties carry over, the other fields start afresh.
  - `backend/app/documents/`: `common.py` (shared models such as `Party` and `DateParts`, `merge_updates`, which drops invalid LLM values instead of failing the turn, and shared prompt text), `nda.py` (the NDA's own `NdaForm`, schemas and prompt), `generic.py` (the other 10 documents: form, update and turn models built with `create_model` from `documents.json`), `registry.py` (loads `documents.json`, tolerant `resolve_id`), `handlers.py` (one interface over both for `chat.py`).
  - Frontend: `DocumentCreator.tsx` (state, document dropdown, chooser cards, PDF download), `DocumentChat.tsx`, `lib/chat.ts` (client; static greeting). The NDA keeps `NdaPreview` / `NdaPdf`; the others use `DocumentPreview` / `DocumentPdf` with a generated Cover Page (`lib/generic-cover-page.ts`, adds the CC BY 4.0 attribution) and their Standard Terms parsed at build time by `lib/terms-parser.ts` (nested 1. / 1.1 / (a) / (i) lists; throws on unknown markup).
  - Tests: `test_chat_api.py`, `test_generic.py`, `test_registry.py` (also checks that every template variable is a field or a party), `test_nda.py`; `chat.test.ts`, `documents.test.ts`, `terms-parser.test.ts` (parses all 10 templates without losing text), `DocumentPdf.test.tsx`. Live LLM check with `RUN_LIVE_LLM_TESTS=1 uv run pytest tests/test_chat_live.py` (needs the `.env` vars exported).
- **Users, saved documents and polish (PL-7):**
  - `/login/` (`AuthForm.tsx`: "Sign in" / "Create account" toggle, confirm password, errors tied to the fields) on the PL-4 auth API. `AuthProvider` (in `layout.tsx`) checks `GET /api/auth/me` once; `AppShell` wraps every signed-in page and includes `AuthGate`, which sends signed-out users to `/login/`; any 401 from `lib/api.ts` (`apiFetch`) or `lib/chat.ts` signs the user out of the UI.
  - Saved documents: `documents` table and `backend/app/saved.py` (`GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/{id}`, scoped to the user, 404 for others' rows). A row holds the draft (`{id, form}`, validated like a chat request) and its conversation (max 200 messages; max 100 documents per user, then 409; ids outside SQLite's 64-bit range give 422); the list's name and companies come from the registry and the form. The editor autosaves after every chat turn and document pick (`createAutosaver` in `lib/saved-documents.ts`: one save at a time, latest change wins, the first save creates, and a document deleted meanwhile is saved again as a new one) and puts `?id=` in the URL; `/?id=N` reopens a document and `/` starts a new one. `/documents/` lists, opens and deletes them.
  - CSRF: `backend/app/csrf.py` rejects non-GET `/api` requests whose `Origin` is neither the app's own host nor in `ALLOWED_ORIGINS` (default: the Next dev server on :3000). A missing Origin is allowed; `null` and malformed ones are rejected.
  - UI: `AppShell` (logo, "New document" / "My documents", account menu, footer), shared `ui.tsx` (Button, Field, Alert, Loading, Logo), brand colors as Tailwind tokens in `globals.css` (`bg-brand-navy`, `text-brand-gray`, ...; small legal and status text uses `text-slate-600`, as `#888888` is too light for WCAG AA). The draft disclaimer (`lib/disclaimer.ts`) is under the chat, above the preview and at the foot of every PDF page.
  - Tests: `test_saved_api.py`, `test_csrf.py`, chat tests now sign in (autouse `_signed_in` fixture); `api.test.ts`, `auth.test.ts`, `saved-documents.test.ts` (autosaver ordering). The PDF render tests allow 20 s.

Testing and development:
- Backend: `uv run pytest` in `backend/` (about 170 tests; the live LLM tests are skipped unless `RUN_LIVE_LLM_TESTS=1`). Frontend: `npm test`, `npm run lint`, `npm run build` in `frontend/` (about 105 tests).
- Local dev without Docker: run the backend (`uv run uvicorn app.main:create_app --factory`, with the `.env` vars exported) and `npm run dev`; Next proxies `/api` to `BACKEND_URL` (default http://localhost:8000).

Known issues and open points:
- The signed-in screens (editor autosave and `?id=`, My documents, account menu, PDF footer, mobile layout) were checked through the API and tests but not yet by hand in a browser.
- The Docker image is about 1 GB, 607 MB of it the Python dependencies (mostly LiteLLM). A build without cache took over 20 minutes on Docker Desktop for Windows, even though the dependencies had not changed since PL-4. Possible fixes: BuildKit cache mounts for uv and npm, and dropping `UV_COMPILE_BYTECODE`.
- The free model now and then leaves a field value untranslated or asks to confirm a document instead of picking it.

Not yet implemented:
- Persistent storage (the database is still recreated on every start, by design) and rate limiting.
