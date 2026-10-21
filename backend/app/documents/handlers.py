"""One interface over the Mutual NDA and the generic documents, for the chat endpoint."""

from datetime import date
from typing import Protocol

from pydantic import BaseModel

from . import generic, nda, registry
from .common import Party
from .registry import DocumentSpec


class DocumentHandler(Protocol):
    spec: DocumentSpec
    turn_model: type[BaseModel]

    def new_form(self, today: date, parties: list[Party] | None = None) -> BaseModel: ...

    def parse(self, raw: dict) -> BaseModel:
        """Validate a form from the browser; raises ``ValidationError``."""

    def dump(self, form: BaseModel) -> dict:
        """The form as camelCase JSON for the browser."""

    def system_prompt(self, form: BaseModel, today: date, announce: bool) -> str: ...

    def apply(self, form: BaseModel, updates: BaseModel) -> BaseModel: ...


class NdaHandler:
    turn_model = nda.NdaChatTurn

    def __init__(self, spec: DocumentSpec) -> None:
        self.spec = spec

    def new_form(self, today: date, parties: list[Party] | None = None) -> nda.NdaForm:
        return nda.new_form(today, parties)

    def parse(self, raw: dict) -> nda.NdaForm:
        return nda.NdaForm.model_validate(raw)

    def dump(self, form: nda.NdaForm) -> dict:
        return form.model_dump(by_alias=True)

    def system_prompt(self, form: nda.NdaForm, today: date, announce: bool) -> str:
        return nda.build_system_prompt(form, today, registry.catalog_text(self.spec.id), announce)

    def apply(self, form: nda.NdaForm, updates: nda.NdaUpdates) -> nda.NdaForm:
        return nda.apply_updates(form, updates)


class GenericHandler:
    def __init__(self, spec: DocumentSpec) -> None:
        self.spec = spec
        self.turn_model = generic.turn_model(spec)

    def new_form(self, today: date, parties: list[Party] | None = None) -> generic.GenericForm:
        return generic.new_form(self.spec, today, parties)

    def parse(self, raw: dict) -> generic.GenericForm:
        return generic.form_model(self.spec).model_validate(raw)

    def dump(self, form: generic.GenericForm) -> dict:
        return form.model_dump(by_alias=True)

    def system_prompt(self, form: generic.GenericForm, today: date, announce: bool) -> str:
        catalog = registry.catalog_text(self.spec.id)
        return generic.build_system_prompt(self.spec, form, today, catalog, announce)

    def apply(self, form: generic.GenericForm, updates: BaseModel) -> generic.GenericForm:
        return generic.apply_updates(self.spec, form, updates)


def get_handler(document_id: str) -> DocumentHandler:
    """Raises ``KeyError`` for an unknown id."""
    spec = registry.get(document_id)
    return NdaHandler(spec) if spec.kind == "nda" else GenericHandler(spec)
