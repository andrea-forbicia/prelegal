"""Calls the real LLM. Opt-in: RUN_LIVE_LLM_TESTS=1 uv run pytest tests/test_chat_live.py"""

import os
from datetime import date

import pytest

from app import llm
from app.documents import nda

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_LLM_TESTS") != "1", reason="set RUN_LIVE_LLM_TESTS=1 to call the LLM"
)


def test_provider_accepts_the_nda_schema():
    form = nda.NdaForm(parties=[nda.Party(), nda.Party()])
    messages = [
        {"role": "system", "content": nda.build_system_prompt(form, date(2026, 10, 21))},
        {"role": "assistant", "content": "Hi! Who are the two parties?"},
        {"role": "user", "content": "Acme Inc. e Globex SpA, per valutare una partnership."},
    ]

    turn = llm.complete_structured(messages, nda.NdaChatTurn)
    result = nda.apply_updates(form, turn.updates)

    assert turn.reply
    assert {party.company for party in result.parties} == {"Acme Inc.", "Globex SpA"}
