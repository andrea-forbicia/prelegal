from fastapi.testclient import TestClient

from app.main import create_app


def test_signup_creates_user_and_signs_in(client, credentials):
    response = client.post("/api/auth/signup", json=credentials)

    assert response.status_code == 201
    assert response.json() == {"id": 1, "email": "alice@example.com"}
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "samesite=lax" in cookie.lower()
    assert client.get("/api/auth/me").json() == {"id": 1, "email": "alice@example.com"}


def test_signup_normalizes_email(client):
    response = client.post(
        "/api/auth/signup", json={"email": "  Bob@Example.COM ", "password": "long-enough"}
    )
    assert response.status_code == 201
    assert response.json()["email"] == "bob@example.com"


def test_duplicate_email_is_rejected_case_insensitively(signed_up_client, credentials):
    response = signed_up_client.post(
        "/api/auth/signup", json={**credentials, "email": "ALICE@example.com"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


def test_signup_validates_input(client, credentials):
    assert client.post("/api/auth/signup", json={**credentials, "password": "short"}).status_code == 422
    assert client.post("/api/auth/signup", json={**credentials, "email": "nope"}).status_code == 422


def test_password_is_stored_hashed(signed_up_client, credentials, db):
    stored = db.execute("SELECT password_hash FROM users").fetchone()[0]
    assert stored.startswith("scrypt$")
    assert credentials["password"] not in stored


def test_only_session_token_hash_is_stored(signed_up_client, db):
    token = signed_up_client.cookies["session"]
    stored = [row[0] for row in db.execute("SELECT token_hash FROM sessions")]
    assert token not in stored
    assert len(stored) == 1


def test_signin_with_valid_credentials(signed_up_client, credentials):
    signed_up_client.cookies.clear()
    response = signed_up_client.post("/api/auth/signin", json=credentials)
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"
    assert signed_up_client.get("/api/auth/me").status_code == 200


def test_signin_failures_share_one_message(signed_up_client, credentials):
    wrong_password = signed_up_client.post(
        "/api/auth/signin", json={**credentials, "password": "wrong-password"}
    )
    unknown_email = signed_up_client.post(
        "/api/auth/signin", json={**credentials, "email": "nobody@example.com"}
    )
    for response in (wrong_password, unknown_email):
        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid email or password"}


def test_me_requires_a_session(client):
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("session", "forged-token")
    assert client.get("/api/auth/me").status_code == 401


def test_signout_revokes_the_session(signed_up_client):
    token = signed_up_client.cookies["session"]

    response = signed_up_client.post("/api/auth/signout")

    assert response.status_code == 204
    assert signed_up_client.get("/api/auth/me").status_code == 401
    # Replaying the old cookie does not work either.
    signed_up_client.cookies.set("session", token)
    assert signed_up_client.get("/api/auth/me").status_code == 401


def test_signout_without_session_is_harmless(client):
    assert client.post("/api/auth/signout").status_code == 204


def test_expired_session_is_rejected_and_purged(signed_up_client, credentials, db):
    db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'")
    db.commit()
    assert signed_up_client.get("/api/auth/me").status_code == 401

    signed_up_client.post("/api/auth/signin", json=credentials)

    expires = [row[0] for row in db.execute("SELECT expires_at FROM sessions")]
    assert len(expires) == 1
    assert expires[0] > "2000-01-01T00:00:00Z"


def test_database_is_recreated_on_restart(signed_up_client, settings, credentials):
    with TestClient(create_app(settings)) as restarted:
        response = restarted.post("/api/auth/signin", json=credentials)
    assert response.status_code == 401
