"""Calls the real LLM. Opt-in: RUN_LIVE_LLM_TESTS=1 uv run pytest tests/test_chat_live.py"""

import os
from datetime import date

import pytest

from app.documents.handlers import get_handler

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_LLM_TESTS") != "1", reason="set RUN_LIVE_LLM_TESTS=1 to call the LLM"
)

GREETING = {"role": "assistant", "content": "Hi! What would you like to draft?"}


@pytest.fixture(autouse=True)
def _signed_in(signed_up_client):
    """The chat is for signed-in users: sign up on the test's ``client`` first."""


def _chat(client, text: str, document: dict | None = None) -> dict:
    request = {
        "messages": [GREETING, {"role": "user", "content": text}],
        "document": document,
        "today": "2026-10-21",
    }
    response = client.post("/api/chat", json=request)
    assert response.status_code == 200, response.text
    return response.json()


def test_selects_the_nda_and_fills_in_the_parties(client):
    body = _chat(client, "Mi serve un NDA tra Acme Inc. e Globex SpA, per valutare una partnership.")

    assert body["reply"]
    assert body["document"]["id"] == "mutual-nda"
    companies = {party["company"] for party in body["document"]["form"]["parties"]}
    assert companies == {"Acme Inc.", "Globex SpA"}


def test_selects_a_generic_document(client):
    body = _chat(client, "I sell a SaaS product and need subscription terms for a customer.")

    assert body["document"]["id"] == "csa"


def test_unsupported_document_is_declined(client):
    body = _chat(client, "I need an employment contract for a new engineer.")

    assert body["document"] is None
    assert body["reply"]


def test_fills_in_a_generic_document(client):
    form = get_handler("pilot").new_form(date(2026, 10, 21))
    document = {"id": "pilot", "form": form.model_dump(by_alias=True)}

    body = _chat(client, "The pilot runs for 60 days, under Delaware law.", document)

    values = body["document"]["form"]["values"]
    assert "60" in values["pilot_period"]
    assert "Delaware" in values["governing_law"]
