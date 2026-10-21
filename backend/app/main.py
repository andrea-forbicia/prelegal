"""FastAPI application: JSON API under /api, static frontend at /."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles

from . import auth
from .config import Settings
from .db import init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_db(settings.database_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)

    # Unknown API paths must return JSON, not fall through to the frontend.
    api_methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

    @app.api_route("/api", methods=api_methods, include_in_schema=False)
    @app.api_route("/api/{path:path}", methods=api_methods, include_in_schema=False)
    def api_not_found() -> None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    # Mounted last so it never shadows the API. Skipped when the frontend has
    # not been built, e.g. when running the backend on its own.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

    return app
