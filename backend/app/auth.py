"""Sign up, sign in and session handling under /api/auth."""

import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from .config import Settings
from .db import get_db
from .security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

Db = Annotated[sqlite3.Connection, Depends(get_db)]

_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"  # Matches the SQLite column defaults.


class Credentials(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class UserOut(BaseModel):
    id: int
    email: str


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _timestamp(moment: datetime) -> str:
    return moment.strftime(_TIMESTAMP_FORMAT)


def _start_session(db: sqlite3.Connection, response: Response, settings: Settings, user_id: int) -> None:
    token = new_session_token()
    ttl = timedelta(hours=settings.session_ttl_hours)
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (_timestamp(datetime.now(UTC)),))
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (hash_session_token(token), user_id, _timestamp(datetime.now(UTC) + ttl)),
    )
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=int(ttl.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def get_current_user(request: Request, db: Db) -> UserOut:
    """Dependency for routes that require a signed-in user."""
    token = request.cookies.get(_settings(request).session_cookie_name)
    if token:
        row = db.execute(
            """
            SELECT users.id, users.email FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (hash_session_token(token), _timestamp(datetime.now(UTC))),
        ).fetchone()
        if row:
            return UserOut(id=row["id"], email=row["email"])
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")


CurrentUser = Annotated[UserOut, Depends(get_current_user)]


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(credentials: Credentials, request: Request, response: Response, db: Db) -> UserOut:
    try:
        cursor = db.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (credentials.email, hash_password(credentials.password)),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from None
    user_id = cursor.lastrowid
    _start_session(db, response, _settings(request), user_id)
    return UserOut(id=user_id, email=credentials.email)


@router.post("/signin")
def signin(credentials: Credentials, request: Request, response: Response, db: Db) -> UserOut:
    row = db.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?", (credentials.email,)
    ).fetchone()
    # Always run the hash check so unknown emails take as long as wrong passwords.
    password_ok = verify_password(
        credentials.password, row["password_hash"] if row else DUMMY_PASSWORD_HASH
    )
    if row is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    _start_session(db, response, _settings(request), row["id"])
    return UserOut(id=row["id"], email=row["email"])


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(request: Request, response: Response, db: Db) -> None:
    settings = _settings(request)
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_session_token(token),))
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return user
