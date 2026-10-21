"""AI chat that drafts a document by filling in its fields, under /api/chat.

The endpoint is stateless: each turn the browser sends the whole conversation
and the current form, and gets back the assistant's reply and the updated form.
"""

import logging
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from . import llm
from .documents import nda

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Mirrored by MAX_HISTORY and MAX_MESSAGE_LENGTH in frontend/src/lib/nda-chat.ts.
MAX_MESSAGES = 40
MAX_MESSAGE_LENGTH = 4000

# Used when the LLM returns an empty reply: the browser sends replies back as
# history, and an empty message would fail validation on every later turn.
FALLBACK_REPLY = "I've updated the agreement. Please check the preview."


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class NdaChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    form: nda.NdaForm
    # The user's local date, so relative dates resolve in their timezone.
    today: date

    @model_validator(mode="after")
    def ends_with_user_message(self) -> "NdaChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must come from the user")
        return self


class NdaChatResponse(BaseModel):
    reply: str
    form: nda.NdaForm


# Public on purpose until the sign-in UI exists; then require `CurrentUser`.
@router.post("/nda")
def nda_chat(body: NdaChatRequest) -> NdaChatResponse:
    # A plain `def`: FastAPI runs it in a threadpool, so the blocking LLM call
    # does not stall the event loop.
    messages = [
        {"role": "system", "content": nda.build_system_prompt(body.form, body.today)},
        *(message.model_dump() for message in body.messages),
    ]
    try:
        turn = llm.complete_structured(messages, nda.NdaChatTurn)
    except llm.LLMError:
        logger.exception("NDA chat turn failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "The assistant is unavailable. Please try again."
        ) from None
    return NdaChatResponse(
        reply=turn.reply.strip()[:MAX_MESSAGE_LENGTH] or FALLBACK_REPLY,
        form=nda.apply_updates(body.form, turn.updates),
    )
