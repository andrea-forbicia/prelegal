"""Models and prompt text shared by every document type."""

import json
from collections.abc import Iterable
from datetime import date
from typing import Annotated, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, ValidationError
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Snake case in Python, camelCase in JSON, as the frontend expects.

    Unknown keys are rejected, so a form sent with the wrong document id fails.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
        extra="forbid",
    )


def check_iso_date(value: str) -> str:
    if value:
        date.fromisoformat(value)  # Rejects e.g. 2026-02-31.
    return value


# An ISO date (YYYY-MM-DD) or empty.
IsoDate = Annotated[str, AfterValidator(check_iso_date)]


class Party(CamelModel):
    company: str = Field("", max_length=200)
    name: str = Field("", max_length=200)
    title: str = Field("", max_length=200)
    notice_address: str = Field("", max_length=500)


class DateParts(BaseModel):
    """A date as named parts: the LLM swaps day and month less often than in a string."""

    year: int
    month: int
    day: int

    @classmethod
    def from_iso(cls, value: str) -> "DateParts | None":
        if not value:
            return None
        parsed = date.fromisoformat(value)
        return cls(year=parsed.year, month=parsed.month, day=parsed.day)

    def to_iso(self) -> str | None:
        """``None`` for an impossible date such as February 31."""
        try:
            return date(self.year, self.month, self.day).isoformat()
        except ValueError:
            return None


class PartyUpdates(BaseModel):
    company: str | None
    name: str | None
    title: str | None
    notice_address: str | None


M = TypeVar("M", bound=BaseModel)


def merge_updates(model: type[M], data: dict, values: dict, updates: BaseModel) -> M:
    """Merge the LLM's ``updates`` into ``data`` (a dumped form), dropping any value ``model`` rejects.

    ``values`` is the dict inside ``data`` that holds the updates' fields; the
    parties are always ``data["parties"]``, updated from ``party1`` and ``party2``.
    One hallucinated value (say, a 150-year term) is skipped rather than
    failing the whole turn.
    """

    def try_set(target: dict, key: str, value: object) -> None:
        previous = target[key]
        target[key] = value
        try:
            model.model_validate(data)
        except ValidationError:
            target[key] = previous

    for key in type(updates).model_fields.keys() - {"party1", "party2"}:
        value = getattr(updates, key)
        if isinstance(value, DateParts):
            value = value.to_iso()  # None for an impossible date: skipped.
        if value is not None:
            try_set(values, key, value)
    for party, party_updates in zip(data["parties"], (updates.party1, updates.party2)):
        if party_updates is not None:
            for key, value in party_updates.model_dump().items():
                if value is not None:
                    try_set(party, key, value)

    return model.model_validate(data)


def form_json(values: dict, date_keys: Iterable[str], parties: list[Party]) -> str:
    """The form as the LLM sees it: its update field names, dates as parts.

    ``<`` and ``>`` are escaped so a value cannot close the ``<form>`` block of
    the prompt; the JSON still means the same.
    """
    view = dict(values)
    for key in date_keys:
        parts = DateParts.from_iso(view[key])
        view[key] = parts.model_dump() if parts else None
    view["party1"], view["party2"] = (party.model_dump() for party in parties)
    text = json.dumps(view, indent=2, ensure_ascii=False)
    return text.replace("<", "\\u003c").replace(">", "\\u003e")


SWITCH_TO_FIELD = Field(
    None,
    description="The id of another supported document to switch to, only when the user clearly "
    "asks for it or accepts your offer; otherwise null.",
)

DATE_RULES = """\
Dates are {"year", "month", "day"}. Resolve relative dates such as "today" or "next Monday" \
from today's date; a date without a year is the next one on or after today. Read numeric dates \
such as 1/12/2026 as day/month/year, unless the user writes in US English; if a date is \
ambiguous, ask."""


def document_rules(catalog: str) -> str:
    """How to handle requests for other documents, as a block of prompt bullets."""
    return f"""\
- These are the only documents Prelegal can draft:
{catalog}
- If the user clearly asks for one of these other documents, or accepts your offer of one, \
set switch_to to its id. The parties carry over to the new document; the other answers do not.
- If the user asks for a document Prelegal cannot draft (say, an employment contract or a \
lease), say plainly that you can't generate it, name the closest document above and why it \
fits, and ask whether they want it. Leave switch_to null until they agree."""


ANNOUNCE = """\
- The user has just chosen this document. Say so in one short sentence, fill in anything they \
already told you in the conversation, then ask for the first missing details."""
