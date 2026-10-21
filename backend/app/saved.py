"""The signed-in user's saved documents, under /api/documents.

The frontend saves the draft and its conversation after every chat turn, so
the user can come back to a document and keep chatting. Every query is scoped
to the current user; another user's document is reported as not found.
"""

import json
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from pydantic import BaseModel, Field

from .auth import CurrentUser, Db
from .chat import ChatMessage, Document, DocumentState
from .documents import registry
from .documents.common import CamelModel
from .documents.handlers import get_handler

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Mirrored by MAX_SAVED_MESSAGES in frontend/src/lib/saved-documents.ts.
MAX_SAVED_MESSAGES = 200
# Sign-up is open, so cap what one account can store.
MAX_DOCUMENTS_PER_USER = 100

# SQLite integers are 64-bit: a larger id would fail the query instead of a 404.
SavedId = Annotated[int, Path(ge=1, le=2**63 - 1)]


class SavedDocumentIn(BaseModel):
    document: DocumentState
    # Unlike a chat request, the conversation may end with the assistant.
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_SAVED_MESSAGES)


class SavedDocumentSummary(CamelModel):
    id: int
    document_id: str
    name: str
    companies: list[str]
    updated_at: str


class SavedDocument(SavedDocumentSummary):
    document: Document
    messages: list[ChatMessage]


def _summary(row: sqlite3.Row) -> SavedDocumentSummary:
    """Name and companies come from the registry and the form, never from the client."""
    form = json.loads(row["form"])
    try:
        name = registry.get(row["document_id"]).name
    except KeyError:  # A document type removed from documents.json since.
        name = row["document_id"]
    companies = [party["company"] for party in form.get("parties", []) if party.get("company")]
    return SavedDocumentSummary(
        id=row["id"],
        document_id=row["document_id"],
        name=name,
        companies=companies,
        updated_at=row["updated_at"],
    )


def _get(db: sqlite3.Connection, user_id: int, saved_id: int) -> SavedDocument:
    row = db.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?", (saved_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return SavedDocument(
        **_summary(row).model_dump(),
        document=Document(id=row["document_id"], form=json.loads(row["form"])),
        messages=json.loads(row["messages"]),
    )


def _columns(body: SavedDocumentIn) -> tuple[str, str, str]:
    """The document id, its normalised form and the messages, as stored."""
    handler = get_handler(body.document.id)
    form = handler.dump(handler.parse(body.document.form))
    messages = [message.model_dump() for message in body.messages]
    return body.document.id, json.dumps(form), json.dumps(messages)


@router.get("")
def list_documents(user: CurrentUser, db: Db) -> list[SavedDocumentSummary]:
    # Not the messages: the list only needs what _summary reads.
    rows = db.execute(
        """
        SELECT id, document_id, form, updated_at FROM documents
        WHERE user_id = ? ORDER BY updated_at DESC, id DESC
        """,
        (user.id,),
    ).fetchall()
    return [_summary(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_document(body: SavedDocumentIn, user: CurrentUser, db: Db) -> SavedDocument:
    (count,) = db.execute("SELECT COUNT(*) FROM documents WHERE user_id = ?", (user.id,)).fetchone()
    if count >= MAX_DOCUMENTS_PER_USER:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You can keep up to {MAX_DOCUMENTS_PER_USER} documents. Delete one to save a new one.",
        )
    cursor = db.execute(
        "INSERT INTO documents (user_id, document_id, form, messages) VALUES (?, ?, ?, ?)",
        (user.id, *_columns(body)),
    )
    return _get(db, user.id, cursor.lastrowid)


@router.get("/{saved_id}")
def get_document(saved_id: SavedId, user: CurrentUser, db: Db) -> SavedDocument:
    return _get(db, user.id, saved_id)


@router.put("/{saved_id}")
def update_document(saved_id: SavedId, body: SavedDocumentIn, user: CurrentUser, db: Db) -> SavedDocument:
    # The assistant can switch document type mid-chat, so the id may change too.
    cursor = db.execute(
        """
        UPDATE documents
        SET document_id = ?, form = ?, messages = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND user_id = ?
        """,
        (*_columns(body), saved_id, user.id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return _get(db, user.id, saved_id)


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(saved_id: SavedId, user: CurrentUser, db: Db) -> None:
    cursor = db.execute(
        "DELETE FROM documents WHERE id = ? AND user_id = ?", (saved_id, user.id)
    )
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
