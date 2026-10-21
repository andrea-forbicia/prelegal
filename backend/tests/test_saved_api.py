import pytest
from fastapi.testclient import TestClient

from app import saved
from app.documents import nda

EMPTY_PARTY = {"company": "", "name": "", "title": "", "noticeAddress": ""}
MESSAGES = [
    {"role": "assistant", "content": "Hi! What would you like to draft?"},
    {"role": "user", "content": "An NDA with Globex"},
    {"role": "assistant", "content": "Who signs for your company?"},
]


def _nda(**overrides) -> dict:
    form = nda.NdaForm(parties=[nda.Party(), nda.Party()]).model_dump(by_alias=True)
    return {"id": "mutual-nda", "form": form | overrides}


def _pilot(**values) -> dict:
    return {"id": "pilot", "form": {"values": values, "parties": [EMPTY_PARTY, EMPTY_PARTY]}}


def _body(document: dict | None = None, messages: list | None = None) -> dict:
    return {"document": document or _nda(), "messages": messages or MESSAGES}


def _create(client, **kwargs) -> dict:
    response = client.post("/api/documents", json=_body(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def other_client(signed_up_client) -> TestClient:
    """A second user on the same app, with its own cookies.

    Not used as a context manager: that would run the start-up again, which
    recreates the database.
    """
    other = TestClient(signed_up_client.app)
    response = other.post(
        "/api/auth/signup", json={"email": "bob@example.com", "password": "another secret"}
    )
    assert response.status_code == 201
    return other


def test_create_returns_the_saved_document(signed_up_client):
    parties = [EMPTY_PARTY | {"company": "Acme Inc."}, EMPTY_PARTY | {"company": " "}]

    saved_doc = _create(signed_up_client, document=_nda(governingLaw=" Delaware ", parties=parties))

    assert saved_doc["id"] == 1
    assert saved_doc["documentId"] == "mutual-nda"
    assert saved_doc["name"] == "Mutual Non-Disclosure Agreement"
    assert saved_doc["companies"] == ["Acme Inc."]  # Blank companies are left out.
    assert saved_doc["document"]["form"]["governingLaw"] == "Delaware"  # Normalised.
    assert saved_doc["messages"] == MESSAGES
    assert saved_doc["updatedAt"].endswith("Z")


def test_get_and_list(signed_up_client):
    first = _create(signed_up_client)
    second = _create(signed_up_client, document=_pilot(pilot_period="60 days"))

    assert signed_up_client.get(f"/api/documents/{first['id']}").json() == first
    listed = signed_up_client.get("/api/documents").json()
    assert [doc["id"] for doc in listed] == [second["id"], first["id"]]  # Newest first.
    assert listed[0] == {
        "id": second["id"],
        "documentId": "pilot",
        "name": "Pilot Agreement",
        "companies": [],
        "updatedAt": second["updatedAt"],
    }


def test_update_replaces_the_document_and_can_switch_type(signed_up_client):
    created = _create(signed_up_client)
    messages = [*MESSAGES, {"role": "user", "content": "Make it a pilot instead"}]

    response = signed_up_client.put(
        f"/api/documents/{created['id']}",
        json=_body(document=_pilot(pilot_period="30 days"), messages=messages),
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["documentId"] == "pilot"
    assert updated["document"]["form"]["values"]["pilot_period"] == "30 days"
    assert updated["messages"] == messages
    assert len(signed_up_client.get("/api/documents").json()) == 1


def test_update_moves_the_document_to_the_top_of_the_list(signed_up_client, db):
    first = _create(signed_up_client)
    _create(signed_up_client)
    # Timestamps have one-second resolution: age the rows instead of sleeping.
    db.execute("UPDATE documents SET updated_at = '2026-01-01T00:00:00Z'")
    db.commit()

    signed_up_client.put(f"/api/documents/{first['id']}", json=_body())

    assert signed_up_client.get("/api/documents").json()[0]["id"] == first["id"]


def test_delete(signed_up_client):
    created = _create(signed_up_client)

    assert signed_up_client.delete(f"/api/documents/{created['id']}").status_code == 204
    assert signed_up_client.get(f"/api/documents/{created['id']}").status_code == 404
    assert signed_up_client.delete(f"/api/documents/{created['id']}").status_code == 404
    assert signed_up_client.get("/api/documents").json() == []


def test_users_only_see_their_own_documents(signed_up_client, other_client):
    created = _create(signed_up_client)
    path = f"/api/documents/{created['id']}"

    assert other_client.get("/api/documents").json() == []
    assert other_client.get(path).status_code == 404
    assert other_client.put(path, json=_body()).status_code == 404
    assert other_client.delete(path).status_code == 404
    assert signed_up_client.get(path).status_code == 200


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/documents"),
        ("POST", "/api/documents"),
        ("GET", "/api/documents/1"),
        ("PUT", "/api/documents/1"),
        ("DELETE", "/api/documents/1"),
    ],
)
def test_sign_in_is_required(client, method, path):
    response = client.request(method, path, json=_body())
    assert response.status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        _body(document={"id": "lease", "form": {}}),
        _body(document=_nda(mndaTermYears=0)),
        _body(document=_pilot(unknown_field="x")),
        {"document": _nda(), "messages": []},
        _body(messages=[{"role": "user", "content": "hi"}] * (saved.MAX_SAVED_MESSAGES + 1)),
        _body(messages=[{"role": "system", "content": "hi"}]),
    ],
)
def test_invalid_documents_are_rejected(signed_up_client, body):
    assert signed_up_client.post("/api/documents", json=body).status_code == 422


def test_a_document_type_removed_since_still_lists(signed_up_client, db):
    created = _create(signed_up_client)
    db.execute("UPDATE documents SET document_id = 'retired'")
    db.commit()

    [listed] = signed_up_client.get("/api/documents").json()

    assert listed["id"] == created["id"]
    assert listed["name"] == "retired"


@pytest.mark.parametrize("saved_id", ["0", "-1", str(2**63), "abc"])
def test_out_of_range_ids_are_rejected(signed_up_client, saved_id):
    path = f"/api/documents/{saved_id}"
    assert signed_up_client.get(path).status_code == 422
    assert signed_up_client.put(path, json=_body()).status_code == 422
    assert signed_up_client.delete(path).status_code == 422


def test_documents_per_user_are_capped(signed_up_client, db, monkeypatch):
    monkeypatch.setattr(saved, "MAX_DOCUMENTS_PER_USER", 2)
    _create(signed_up_client)
    _create(signed_up_client)

    response = signed_up_client.post("/api/documents", json=_body())

    assert response.status_code == 409
    assert "up to 2 documents" in response.json()["detail"]
