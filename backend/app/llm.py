"""LLM access via LiteLLM and OpenRouter, with Cerebras as the inference provider.

LiteLLM reads ``OPENROUTER_API_KEY`` from the environment. ``LLM_MODEL``
overrides the default model without a code change.
"""

import os
from typing import TypeVar

import litellm
from pydantic import BaseModel, ValidationError

DEFAULT_MODEL = "openrouter/minimax/minimax-m3.1-flash:free"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

T = TypeVar("T", bound=BaseModel)


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
    """Ask for a Structured Outputs response and parse it into ``response_model``."""
    content = _complete(messages, response_format=response_model)
    try:
        return response_model.model_validate_json(content or "")
    except ValidationError as exc:
        raise LLMError("LLM response did not match the expected schema") from exc
