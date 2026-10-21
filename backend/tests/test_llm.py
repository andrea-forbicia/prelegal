from types import SimpleNamespace

import litellm
import pytest
from pydantic import BaseModel

from app import llm


class Party(BaseModel):
    name: str
    jurisdiction: str


def _fake_completion(content: str | None, calls: list[dict]):
    def fake(**kwargs):
        calls.append(kwargs)
        message = SimpleNamespace(content=content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    return fake


def test_complete_structured_parses_the_response(monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    calls: list[dict] = []
    monkeypatch.setattr(
        litellm, "completion", _fake_completion('{"name": "Acme", "jurisdiction": "Delaware"}', calls)
    )
    messages = [{"role": "user", "content": "Who is the party?"}]

    result = llm.complete_structured(messages, Party)

    assert result == Party(name="Acme", jurisdiction="Delaware")
    assert calls == [
        {
            "model": "openrouter/minimax/minimax-m3.1-flash:free",
            "messages": messages,
            "response_format": Party,
            "reasoning_effort": "low",
            "extra_body": {"provider": {"order": ["cerebras"]}},
        }
    ]


@pytest.mark.parametrize("content", ['{"name": "Acme"}', "not json", None])
def test_complete_structured_rejects_invalid_output(monkeypatch, content):
    monkeypatch.setattr(litellm, "completion", _fake_completion(content, []))
    with pytest.raises(llm.LLMError, match="expected schema"):
        llm.complete_structured([{"role": "user", "content": "hi"}], Party)


def test_complete_text(monkeypatch):
    calls: list[dict] = []
    monkeypatch.setattr(litellm, "completion", _fake_completion("Hello", calls))

    assert llm.complete_text([{"role": "user", "content": "hi"}]) == "Hello"
    assert "response_format" not in calls[0]
    assert calls[0]["extra_body"] == llm.EXTRA_BODY


def test_provider_errors_are_wrapped(monkeypatch):
    def failing(**kwargs):
        raise ConnectionError("boom")

    monkeypatch.setattr(litellm, "completion", failing)
    with pytest.raises(llm.LLMError, match="boom"):
        llm.complete_structured([{"role": "user", "content": "hi"}], Party)


def test_model_can_be_overridden_by_env(monkeypatch):
    calls: list[dict] = []
    monkeypatch.setattr(litellm, "completion", _fake_completion("Hello", calls))
    monkeypatch.setenv("LLM_MODEL", "openrouter/some/other-model")

    llm.complete_text([{"role": "user", "content": "hi"}])

    assert calls[0]["model"] == "openrouter/some/other-model"
