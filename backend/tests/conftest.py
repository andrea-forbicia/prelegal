import sqlite3
from collections.abc import Iterator
from types import SimpleNamespace

import litellm
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import connect
from app.main import create_app


@pytest.fixture
def settings(tmp_path) -> Settings:
    static_dir = tmp_path / "static"
    (static_dir / "fonts").mkdir(parents=True)
    (static_dir / "index.html").write_text("<html>Prelegal</html>", encoding="utf-8")
    (static_dir / "404.html").write_text("<html>Not found</html>", encoding="utf-8")
    (static_dir / "fonts" / "test.ttf").write_bytes(b"font")
    return Settings(database_path=tmp_path / "data" / "test.db", static_dir=static_dir)


@pytest.fixture
def client(settings) -> Iterator[TestClient]:
    # The context manager runs the lifespan, which creates the database.
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def db(client, settings) -> Iterator[sqlite3.Connection]:
    """Direct access to the app's database, for assertions and test setup."""
    conn = connect(settings.database_path)
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def credentials() -> dict[str, str]:
    return {"email": "alice@example.com", "password": "correct horse"}


@pytest.fixture
def signed_up_client(client, credentials) -> TestClient:
    assert client.post("/api/auth/signup", json=credentials).status_code == 201
    return client


class FakeLLM:
    """Stands in for ``litellm.completion`` and records each call's kwargs.

    Returns ``replies`` in order, repeating the last one, or raises ``error``.
    """

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.replies: list[str | None] = [None]
        self.error: Exception | None = None

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        content = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture
def fake_llm(monkeypatch) -> FakeLLM:
    fake = FakeLLM()
    monkeypatch.setattr(litellm, "completion", fake)
    return fake
