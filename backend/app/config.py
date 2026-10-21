"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_origins(name: str, default: frozenset[str]) -> frozenset[str]:
    value = os.environ.get(name)
    if value is None:
        return default
    return frozenset(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())


DEV_ORIGINS = frozenset({"http://localhost:3000", "http://127.0.0.1:3000"})


@dataclass(frozen=True)
class Settings:
    database_path: Path
    static_dir: Path
    session_ttl_hours: int = 24 * 7
    cookie_secure: bool = False
    session_cookie_name: str = "session"
    # Origins, besides the app's own, allowed to make state-changing requests:
    # the Next.js dev server proxies /api with the browser's Origin unchanged.
    allowed_origins: frozenset[str] = DEV_ORIGINS

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("DATABASE_PATH", "prelegal.db")),
            static_dir=Path(os.environ.get("STATIC_DIR", "../frontend/out")),
            session_ttl_hours=int(os.environ.get("SESSION_TTL_HOURS", 24 * 7)),
            cookie_secure=_env_bool("COOKIE_SECURE", False),
            allowed_origins=_env_origins("ALLOWED_ORIGINS", DEV_ORIGINS),
        )
