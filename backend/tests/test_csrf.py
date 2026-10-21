import pytest

from app.csrf import origin_allowed

DEV = frozenset({"http://localhost:3000"})


@pytest.mark.parametrize(
    ("origin", "host", "allowed"),
    [
        (None, "prelegal.example", True),  # Same-origin or a non-browser client.
        ("https://prelegal.example", "prelegal.example", True),
        ("http://prelegal.example", "prelegal.example", True),  # TLS proxy: host only.
        ("http://localhost:3000", "localhost:8000", True),  # The Next.js dev server.
        ("http://localhost:3000/", "localhost:8000", True),
        ("https://evil.example", "prelegal.example", False),
        ("https://prelegal.example.evil.example", "prelegal.example", False),
        ("null", "prelegal.example", False),
        ("https://prelegal.example", None, False),
        ("http://[::1", "prelegal.example", False),
    ],
)
def test_origin_allowed(origin, host, allowed):
    assert origin_allowed(origin, host, DEV) is allowed


def test_cross_origin_state_changes_are_blocked(client, credentials):
    response = client.post(
        "/api/auth/signup", json=credentials, headers={"Origin": "https://evil.example"}
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Cross-origin request blocked"}
    assert "session" not in client.cookies


@pytest.mark.parametrize("origin", [None, "http://testserver", "http://localhost:3000"])
def test_same_origin_and_dev_requests_pass(client, credentials, origin):
    headers = {"Origin": origin} if origin else {}
    response = client.post("/api/auth/signup", json=credentials, headers=headers)
    assert response.status_code == 201


def test_reads_and_pages_are_not_checked(signed_up_client):
    evil = {"Origin": "https://evil.example"}
    assert signed_up_client.get("/api/auth/me", headers=evil).status_code == 200
    assert signed_up_client.get("/", headers=evil).status_code == 200
