"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_path: Path
    static_dir: Path
    session_ttl_hours: int = 24 * 7
    cookie_secure: bool = False
    session_cookie_name: str = "session"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("DATABASE_PATH", "prelegal.db")),
            static_dir=Path(os.environ.get("STATIC_DIR", "../frontend/out")),
            session_ttl_hours=int(os.environ.get("SESSION_TTL_HOURS", 24 * 7)),
            cookie_secure=_env_bool("COOKIE_SECURE", False),
        )
