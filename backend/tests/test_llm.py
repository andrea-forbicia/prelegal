import pytest
from pydantic import BaseModel

from app import llm


class Party(BaseModel):
    name: str
    jurisdiction: str


ACME_JSON = '{"name": "Acme", "jurisdiction": "Delaware"}'


def test_complete_structured_parses_the_response(monkeypatch, fake_llm):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    fake_llm.replies = [ACME_JSON]
    messages = [{"role": "user", "content": "Who is the party?"}]

    result = llm.complete_structured(messages, Party)

    assert result == Party(name="Acme", jurisdiction="Delaware")
    instruction = fake_llm.calls[0]["messages"][0]
    assert instruction["role"] == "system"
    assert '"jurisdiction"' in instruction["content"]  # the schema is in the prompt
    assert fake_llm.calls == [
        {
            "model": "openrouter/minimax/minimax-m3.1-flash:free",
            "messages": [instruction, *messages],
            "response_format": Party,
            "reasoning_effort": "low",
            "extra_body": {"provider": {"order": ["cerebras"]}},
        }
    ]


def test_schema_instruction_is_appended_to_an_existing_system_prompt(fake_llm):
    fake_llm.replies = [ACME_JSON]

    llm.complete_structured(
        [{"role": "system", "content": "Be brief."}, {"role": "user", "content": "hi"}], Party
    )

    system, user = fake_llm.calls[0]["messages"]
    assert system["content"].startswith("Be brief.\n\nRespond with only a JSON object")
    assert user == {"role": "user", "content": "hi"}


@pytest.mark.parametrize(
    "content",
    [
        f"```json\n{ACME_JSON}\n```",
        f"```\n{ACME_JSON}\n```",
        f"Here you go:\n{ACME_JSON}\nAnything else?",
    ],
)
def test_json_is_extracted_from_surrounding_text(fake_llm, content):
    fake_llm.replies = [content]
    result = llm.complete_structured([{"role": "user", "content": "hi"}], Party)
    assert result == Party(name="Acme", jurisdiction="Delaware")


def test_invalid_output_is_retried_once(fake_llm):
    fake_llm.replies = ["Acme, in Delaware.", ACME_JSON]

    result = llm.complete_structured([{"role": "user", "content": "hi"}], Party)

    assert result == Party(name="Acme", jurisdiction="Delaware")
    assert len(fake_llm.calls) == 2
    *_, bad_reply, correction = fake_llm.calls[1]["messages"]
    assert bad_reply == {"role": "assistant", "content": "Acme, in Delaware."}
    assert correction["role"] == "user"


@pytest.mark.parametrize("content", ['{"name": "Acme"}', "not json", None])
def test_complete_structured_rejects_invalid_output(fake_llm, content):
    fake_llm.replies = [content]
    with pytest.raises(llm.LLMError, match="expected schema"):
        llm.complete_structured([{"role": "user", "content": "hi"}], Party)
    assert len(fake_llm.calls) == 2


def test_complete_text(fake_llm):
    fake_llm.replies = ["Hello"]

    assert llm.complete_text([{"role": "user", "content": "hi"}]) == "Hello"
    assert "response_format" not in fake_llm.calls[0]
    assert fake_llm.calls[0]["extra_body"] == llm.EXTRA_BODY


def test_provider_errors_are_wrapped(fake_llm):
    fake_llm.error = ConnectionError("boom")
    with pytest.raises(llm.LLMError, match="boom"):
        llm.complete_structured([{"role": "user", "content": "hi"}], Party)


def test_model_can_be_overridden_by_env(monkeypatch, fake_llm):
    fake_llm.replies = ["Hello"]
    monkeypatch.setenv("LLM_MODEL", "openrouter/some/other-model")

    llm.complete_text([{"role": "user", "content": "hi"}])

    assert fake_llm.calls[0]["model"] == "openrouter/some/other-model"
