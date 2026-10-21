# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

[@catalog.json](catalog.json)

The catalog lists 12 templates. So far only the Mutual NDA can be drafted (via AI chat), and the backend auth API exists but has no UI yet. See "Current status" at the end of this file.

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
The database uses SQLite and is created from scratch each time the app starts (`init_db` deletes and recreates it), with a users table for sign up and sign in.
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

Implemented so far (Jira PL-2 → PL-5):
- **Templates (PL-2):** 12 Common Paper templates in `templates/`, indexed by `catalog.json`.
- **Mutual NDA Creator (PL-3):** Next.js UI (`frontend/src/components/Nda*.tsx`) with a form (replaced by AI chat in PL-5), live preview and PDF download (`@react-pdf/renderer`, Noto fonts in `frontend/public/fonts`). The standard terms are read from `templates/Mutual-NDA.md` at build time. Tests: Vitest (`npm test`).
- **V1 foundation (PL-4):**
  - FastAPI app factory `backend/app/main.py`: `/api/health`, JSON 404 for unknown `/api/*`, static frontend mounted at `/`.
  - Auth `backend/app/auth.py`: `POST /api/auth/signup`, `/signin`, `/signout`, `GET /api/auth/me`, using an HttpOnly session cookie. The `users` and `sessions` tables are in `backend/app/db.py`.
  - LLM client `backend/app/llm.py`: `complete_text` / `complete_structured` (Pydantic Structured Outputs) via LiteLLM → OpenRouter → Cerebras. `LLM_MODEL` overrides the model.
  - Settings via env (`backend/app/config.py`): `DATABASE_PATH`, `STATIC_DIR`, `SESSION_TTL_HOURS`, `COOKIE_SECURE`.
  - Docker, plus start/stop scripts for mac/linux/windows (they need `.env`). Tests: pytest (`uv run pytest` in `backend/`).

- **AI chat for the Mutual NDA (PL-5):** the form is gone; `frontend/src/components/NdaChat.tsx` sits next to the live preview.
  - `POST /api/chat/nda` (`backend/app/chat.py`) is stateless and public: each turn the browser sends `{messages, form, today}` and gets `{reply, form}` (502 if the LLM fails, 422 for invalid input; max 40 messages of 4000 chars).
  - `backend/app/documents/nda.py`: `NdaForm` (camelCase JSON, the single validator), the `NdaUpdates` / `NdaChatTurn` structured-output schemas, the system prompt, and `apply_updates`, which drops invalid LLM values instead of failing the turn.
  - The `:free` MiniMax model is no longer served by Cerebras and its endpoint ignores `response_format`, so `complete_structured` also puts the JSON Schema in the prompt, extracts the JSON from the reply and retries once.
  - Tests: `test_nda.py`, `test_chat_api.py`, `nda-chat.test.ts`; live LLM check with `RUN_LIVE_LLM_TESTS=1 uv run pytest tests/test_chat_live.py` (needs the `.env` vars exported).

Not yet implemented:
- Sign-in/sign-up UI (then require sign-in on `/api/chat`), AI chat for the other 11 document types and saved documents.
