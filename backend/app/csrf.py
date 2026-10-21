"""Cross-site request forgery defence: reject state-changing API requests from other origins.

The session cookie is already ``SameSite=Lax``; checking the ``Origin`` header
as well blocks cross-site requests that browsers would still send with it.
"""

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from .config import Settings

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def origin_allowed(origin: str | None, host: str | None, allowed: frozenset[str]) -> bool:
    """Whether a request with this ``Origin`` header may change state.

    A missing header is allowed: browsers always send one on cross-origin
    requests, so its absence means a same-origin request or a non-browser
    client. The app's own origin is compared by host only, since behind a TLS
    proxy the app may see http while the browser uses https.
    """
    if origin is None:
        return True
    if origin.rstrip("/") in allowed:
        return True
    if origin == "null" or host is None:
        return False
    try:
        return urlsplit(origin).netloc == host
    except ValueError:  # A malformed origin, e.g. "http://[::1".
        return False


def add_origin_check(app: FastAPI, settings: Settings) -> None:
    @app.middleware("http")
    async def origin_check(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method not in SAFE_METHODS and request.url.path.startswith("/api"):
            origin = request.headers.get("origin")
            if not origin_allowed(origin, request.headers.get("host"), settings.allowed_origins):
                return JSONResponse(
                    {"detail": "Cross-origin request blocked"}, status.HTTP_403_FORBIDDEN
                )
        return await call_next(request)
