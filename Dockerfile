# Build context is the repository root: the frontend build reads ../templates and
# ../documents.json.

# Stage 1: build the Next.js frontend as a static export (frontend/out).
FROM node:24-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY templates/ /build/templates/
COPY documents.json /build/documents.json
RUN npm run build

# Stage 2: FastAPI backend serving the API and the static frontend.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY catalog.json ./catalog.json
COPY documents.json ./documents.json
COPY templates/ ./templates/
COPY --from=frontend /build/frontend/out ./static

RUN useradd --system --no-create-home prelegal \
    && mkdir -p /app/data \
    && chown prelegal /app/data
USER prelegal

ENV PATH="/app/.venv/bin:$PATH" \
    DATABASE_PATH=/app/data/prelegal.db \
    STATIC_DIR=/app/static
EXPOSE 8000
# A single worker: the database is recreated at startup.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
