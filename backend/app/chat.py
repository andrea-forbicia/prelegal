"""AI chat that picks a document and drafts it by filling in its fields, under /api/chat.

The endpoint is stateless: each turn the browser sends the whole conversation
and the current document (or null before one is chosen), and gets back the
assistant's reply and the updated document.
"""

import logging
from datetime import date
from typing import Literal, TypeVar

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from . import llm
from .documents import registry, selection
from .documents.handlers import DocumentHandler, get_handler

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Mirrored by MAX_HISTORY and MAX_MESSAGE_LENGTH in frontend/src/lib/chat.ts.
MAX_MESSAGES = 40
MAX_MESSAGE_LENGTH = 4000

# Used when the LLM returns an empty reply: the browser sends replies back as
# history, and an empty message would fail validation on every later turn.
FALLBACK_REPLY = "I've updated the agreement. Please check the preview."


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class Document(BaseModel):
    """The document being drafted: its id in documents.json and its camelCase form."""

    id: str
    form: dict


class DocumentState(Document):
    """A document from the browser, checked against its own form model."""

    @model_validator(mode="after")
    def check_form(self) -> "DocumentState":
        try:
            handler = get_handler(self.id)
        except KeyError:
            raise ValueError(f"Unknown document: {self.id}") from None
        handler.parse(self.form)  # ValidationError -> 422
        return self


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    document: DocumentState | None
    # The user's local date, so relative dates resolve in their timezone.
    today: date

    @model_validator(mode="after")
    def ends_with_user_message(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must come from the user")
        return self


class ChatResponse(BaseModel):
    reply: str
    # Built by the server from validated forms: not checked again.
    document: Document | None


# Public on purpose until the sign-in UI exists; then require `CurrentUser`.
@router.post("")
def chat(body: ChatRequest) -> ChatResponse:
    # A plain `def`: FastAPI runs it in a threadpool, so the blocking LLM calls
    # do not stall the event loop.
    history = [message.model_dump() for message in body.messages]
    try:
        reply, document = _run_turn(body.document, history, body.today)
    except llm.LLMError:
        logger.exception("Chat turn failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "The assistant is unavailable. Please try again."
        ) from None
    return ChatResponse(
        reply=reply.strip()[:MAX_MESSAGE_LENGTH] or FALLBACK_REPLY, document=document
    )


def _run_turn(
    current: DocumentState | None, history: list[dict], today: date
) -> tuple[str, Document | None]:
    """One LLM call, or two when a document is chosen or switched.

    The second call drafts the new document from the same conversation, so the
    details the user already gave land in its form and its reply asks the next
    question. Its own ``switch_to`` is ignored, so a turn never loops.
    """
    if current is None:
        prompt = selection.build_system_prompt(today)
        turn = _ask(prompt, history, selection.SelectionTurn)
        target = registry.resolve_id(turn.document_id)
        if target is None:
            return turn.reply, None
        parties = None
    else:
        handler = get_handler(current.id)
        reply, switch_to, form = _draft(handler, handler.parse(current.form), history, today)
        target = registry.resolve_id(switch_to)
        if target in (None, current.id):
            return reply, Document(id=current.id, form=handler.dump(form))
        parties = form.parties  # Carried over; every other field starts afresh.

    handler = get_handler(target)
    form = handler.new_form(today, parties)
    reply, _, form = _draft(handler, form, history, today, announce=True)
    return reply, Document(id=target, form=handler.dump(form))


def _draft(
    handler: DocumentHandler,
    form: BaseModel,
    history: list[dict],
    today: date,
    announce: bool = False,
) -> tuple[str, str | None, BaseModel]:
    """Returns the reply, the requested switch (if any) and the updated form."""
    prompt = handler.system_prompt(form, today, announce)
    turn = _ask(prompt, history, handler.turn_model)
    return turn.reply, turn.switch_to, handler.apply(form, turn.updates)


def _ask(system_prompt: str, history: list[dict], response_model: type[T]) -> T:
    messages = [{"role": "system", "content": system_prompt}, *history]
    return llm.complete_structured(messages, response_model)
