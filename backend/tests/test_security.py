from app.security import (
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)


def test_hash_round_trip():
    stored = hash_password("s3cret-password")
    assert stored.startswith("scrypt$")
    assert "s3cret-password" not in stored
    assert verify_password("s3cret-password", stored)


def test_wrong_password_is_rejected():
    assert not verify_password("wrong", hash_password("right-password"))


def test_same_password_gets_different_salts():
    assert hash_password("same-password") != hash_password("same-password")


def test_malformed_hash_is_rejected():
    assert not verify_password("anything", "not-a-hash")
    assert not verify_password("anything", "bcrypt$00$00")


def test_session_tokens_are_unique_and_hashed():
    first, second = new_session_token(), new_session_token()
    assert first != second
    assert hash_session_token(first) != first
    assert hash_session_token(first) == hash_session_token(first)
