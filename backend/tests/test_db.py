from app.db import connect, init_db


def _tables(path) -> set[str]:
    conn = connect(path)
    try:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    finally:
        conn.close()
    return {row["name"] for row in rows}


def test_init_db_creates_schema(tmp_path):
    path = tmp_path / "nested" / "app.db"
    init_db(path)
    assert {"users", "sessions"} <= _tables(path)


def test_init_db_starts_from_scratch(tmp_path):
    path = tmp_path / "app.db"
    init_db(path)
    conn = connect(path)
    conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x')")
    conn.execute("CREATE TABLE leftover (id INTEGER)")
    conn.commit()
    conn.close()

    init_db(path)

    assert "leftover" not in _tables(path)
    conn = connect(path)
    assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    conn.close()
