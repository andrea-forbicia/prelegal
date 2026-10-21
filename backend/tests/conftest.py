import sqlite3
from collections.abc import Iterator

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
