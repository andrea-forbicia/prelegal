from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_frontend_is_served_at_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Prelegal" in response.text


def test_static_assets_are_served(client):
    response = client.get("/fonts/test.ttf")
    assert response.status_code == 200
    assert response.content == b"font"


def test_unknown_page_uses_frontend_404(client):
    response = client.get("/no-such-page")
    assert response.status_code == 404
    assert "Not found" in response.text


def test_unknown_api_path_returns_json_404(client):
    for method in ("GET", "POST", "OPTIONS"):
        for path in ("/api", "/api/no-such-endpoint"):
            response = client.request(method, path)
            assert response.status_code == 404
            assert response.json() == {"detail": "Not found"}
    assert client.head("/api/no-such-endpoint").status_code == 404


def test_runs_without_a_frontend_build(tmp_path):
    settings = Settings(database_path=tmp_path / "test.db", static_dir=tmp_path / "missing")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404


def test_settings_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "env.db"))
    monkeypatch.setenv("STATIC_DIR", str(tmp_path / "static"))
    monkeypatch.setenv("SESSION_TTL_HOURS", "2")
    monkeypatch.setenv("COOKIE_SECURE", "true")

    settings = Settings.from_env()

    assert settings.database_path == tmp_path / "env.db"
    assert settings.static_dir == tmp_path / "static"
    assert settings.session_ttl_hours == 2
    assert settings.cookie_secure is True
