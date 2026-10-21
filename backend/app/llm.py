"""LLM access via LiteLLM and OpenRouter, with Cerebras as the inference provider.

LiteLLM reads ``OPENROUTER_API_KEY`` from the environment. ``LLM_MODEL``
overrides the default model without a code change.
"""

import json
import os
import re
from typing import TypeVar

import litellm
from pydantic import BaseModel, ValidationError

DEFAULT_MODEL = "openrouter/minimax/minimax-m3.1-flash:free"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

T = TypeVar("T", bound=BaseModel)

_FENCED_JSON = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


class LLMError(RuntimeError):
    """The LLM call failed or returned output that does not match the schema."""


def model_name() -> str:
    return os.environ.get("LLM_MODEL") or DEFAULT_MODEL


def _complete(messages: list[dict], **kwargs) -> str | None:
    try:
        response = litellm.completion(
            model=model_name(),
            messages=messages,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
            **kwargs,
        )
    except Exception as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    return response.choices[0].message.content


def complete_text(messages: list[dict]) -> str:
    return _complete(messages) or ""


def complete_structured(messages: list[dict], response_model: type[T]) -> T:
    """Ask for a Structured Outputs response and parse it into ``response_model``.

    Not every provider honours ``response_format`` (the free MiniMax endpoint
    answers in prose), so the schema is also spelled out in the prompt, the JSON
    is extracted from the reply, and an invalid reply is retried once.
    """
    messages = _with_schema_instruction(messages, response_model)
    content = _complete(messages, response_format=response_model)
    try:
        return _parse(content, response_model)
    except ValidationError:
        retry = [
            *messages,
            {"role": "assistant", "content": content or ""},
            {"role": "user", "content": "Reply again with only the JSON object described above."},
        ]
        content = _complete(retry, response_format=response_model)
    try:
        return _parse(content, response_model)
    except ValidationError as exc:
        raise LLMError("LLM response did not match the expected schema") from exc


def _with_schema_instruction(messages: list[dict], response_model: type[BaseModel]) -> list[dict]:
    instruction = (
        "Respond with only a JSON object, no other text, that matches this JSON Schema:\n"
        + json.dumps(response_model.model_json_schema())
    )
    if messages and messages[0]["role"] == "system":
        first = messages[0]
        return [{**first, "content": f"{first['content']}\n\n{instruction}"}, *messages[1:]]
    return [{"role": "system", "content": instruction}, *messages]


def _parse(content: str | None, response_model: type[T]) -> T:
    """Validate the JSON in ``content``, tolerating code fences or text around it."""
    text = (content or "").strip()
    if fenced := _FENCED_JSON.search(text):
        text = fenced.group(1)
    elif (start := text.find("{")) != -1:
        text = text[start : text.rfind("}") + 1]
    return response_model.model_validate_json(text)
