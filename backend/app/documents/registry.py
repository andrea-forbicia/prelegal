"""The documents Prelegal can draft, loaded from documents.json at the repository root.

The frontend reads the same file at build time, so the document list, the cover
page fields and their descriptions are defined once.
"""

import json
import os
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel


class _Spec(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class FieldSpec(_Spec):
    key: str
    label: str
    type: Literal["text", "longtext", "date"]
    description: str
    # A blank optional field is a valid final answer ("None." on the cover page).
    optional: bool = False


class SectionSpec(_Spec):
    heading: str
    fields: tuple[FieldSpec, ...]


class DocumentSpec(_Spec):
    id: str
    kind: Literal["nda", "generic"]
    name: str
    template: str
    summary: str
    use_for: str
    standards_url: str | None = None
    party_roles: tuple[str, str] | None = None
    sections: tuple[SectionSpec, ...] = ()

    @model_validator(mode="after")
    def check_generic(self) -> "DocumentSpec":
        if self.kind == "generic":
            if not self.party_roles or not self.sections:
                raise ValueError(f"{self.id}: a generic document needs party roles and sections")
            keys = [field.key for field in self.fields]
            if len(keys) != len(set(keys)):
                raise ValueError(f"{self.id}: duplicate field keys")
        return self

    @property
    def fields(self) -> tuple[FieldSpec, ...]:
        return tuple(field for section in self.sections for field in section.fields)


class _Registry(BaseModel):
    documents: tuple[DocumentSpec, ...]

    @model_validator(mode="after")
    def check_ids(self) -> "_Registry":
        ids = [document.id for document in self.documents]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate document ids")
        return self


def _default_path() -> Path:
    # backend/app/documents/registry.py in development, /app/app/documents/registry.py in Docker.
    here = Path(__file__).resolve()
    candidates = [parent / "documents.json" for parent in here.parents[2:4]]
    return next((path for path in candidates if path.exists()), candidates[-1])


@cache
def documents() -> dict[str, DocumentSpec]:
    path = Path(os.environ.get("DOCUMENTS_PATH") or _default_path())
    registry = _Registry.model_validate(json.loads(path.read_text(encoding="utf-8")))
    return {document.id: document for document in registry.documents}


def get(document_id: str) -> DocumentSpec:
    """Raises ``KeyError`` for an unknown id."""
    return documents()[document_id]


def resolve_id(raw: str | None) -> str | None:
    """Match an id the LLM gave, tolerating case and full names; ``None`` if unknown."""
    if not raw:
        return None
    wanted = raw.strip().lower()
    for document in documents().values():
        if wanted in (document.id, document.name.lower(), document.id.replace("-", " ")):
            return document.id
    return None


def catalog_text(exclude: str | None = None) -> str:
    """One prompt line per document: id, name, what it is and when to use it."""
    return "\n".join(
        f'  - "{doc.id}": {doc.name}. {doc.summary} Use for: {doc.use_for}.'
        for doc in documents().values()
        if doc.id != exclude
    )
