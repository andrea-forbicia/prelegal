from datetime import date

import pytest
from pydantic import ValidationError

from app.documents import nda


def _form(**overrides) -> nda.NdaForm:
    data = {"parties": [{}, {}], **overrides}
    return nda.NdaForm.model_validate(data)


def _updates(**values) -> nda.NdaUpdates:
    fields = {name: None for name in nda.NdaUpdates.model_fields}
    return nda.NdaUpdates(**{**fields, **values})


def _party_updates(**values) -> nda.PartyUpdates:
    fields = {name: None for name in nda.PartyUpdates.model_fields}
    return nda.PartyUpdates(**{**fields, **values})


def test_form_uses_camel_case_json():
    form = nda.NdaForm.model_validate(
        {
            "effectiveDate": "2026-10-21",
            "mndaTerm": "untilTerminated",
            "parties": [{"noticeAddress": "a@example.com"}, {}],
        }
    )
    dumped = form.model_dump(by_alias=True)
    assert dumped["effectiveDate"] == "2026-10-21"
    assert dumped["mndaTerm"] == "untilTerminated"
    assert dumped["parties"][0]["noticeAddress"] == "a@example.com"


@pytest.mark.parametrize(
    "overrides",
    [
        {"effectiveDate": "2026-02-31"},
        {"effectiveDate": "next week"},
        {"mndaTermYears": 0},
        {"confidentialityYears": 100},
        {"mndaTerm": "forever"},
        {"parties": [{}]},
        {"purpose": "x" * 1001},
    ],
)
def test_form_rejects_invalid_values(overrides):
    with pytest.raises(ValidationError):
        _form(**overrides)


def test_null_updates_leave_the_form_unchanged():
    form = _form(purpose="Evaluate a deal", governingLaw="Delaware")
    assert nda.apply_updates(form, _updates()) == form


def test_updates_overwrite_only_the_given_fields():
    form = _form(purpose="Evaluate a deal", governingLaw="Delaware")

    result = nda.apply_updates(
        form,
        _updates(governing_law="  California ", mnda_term="untilTerminated", modifications=""),
    )

    assert result.purpose == "Evaluate a deal"
    assert result.governing_law == "California"
    assert result.mnda_term == "untilTerminated"
    assert result.modifications == ""


def test_party_updates_merge_field_by_field():
    form = _form(parties=[{"company": "Acme", "name": "Jane"}, {"company": "Globex"}])

    result = nda.apply_updates(
        form, _updates(party1=_party_updates(title="CEO"), party2=_party_updates(name="Hank"))
    )

    assert result.parties[0] == nda.Party(company="Acme", name="Jane", title="CEO")
    assert result.parties[1] == nda.Party(company="Globex", name="Hank")


def test_date_parts_become_an_iso_date():
    form = _form(effectiveDate="2026-10-21")

    result = nda.apply_updates(form, _updates(effective_date=nda.DateParts(year=2026, month=12, day=1)))

    assert result.effective_date == "2026-12-01"


def test_prompt_shows_the_date_as_parts():
    with_date = nda.build_system_prompt(_form(effectiveDate="2026-12-01"), date(2026, 10, 21))
    without_date = nda.build_system_prompt(_form(), date(2026, 10, 21))

    assert '"effective_date": {\n    "year": 2026,\n    "month": 12,\n    "day": 1\n  }' in with_date
    assert '"effective_date": null' in without_date


def test_invalid_updates_are_dropped_and_valid_ones_kept():
    form = _form(effectiveDate="2026-10-21", mndaTermYears=2)

    result = nda.apply_updates(
        form,
        _updates(
            effective_date=nda.DateParts(year=2026, month=2, day=31),
            mnda_term_years=150,
            confidentiality_years=0,
            jurisdiction="New Castle, DE",
            party1=_party_updates(company="x" * 201, name="Jane"),
        ),
    )

    assert result.effective_date == "2026-10-21"
    assert result.mnda_term_years == 2
    assert result.confidentiality_years == 1
    assert result.jurisdiction == "New Castle, DE"
    assert result.parties[0].company == ""
    assert result.parties[0].name == "Jane"


def test_apply_updates_does_not_mutate_the_input():
    form = _form()
    nda.apply_updates(form, _updates(purpose="New", party1=_party_updates(company="Acme")))
    assert form == _form()


def test_system_prompt_contains_date_and_form():
    form = _form(purpose='Use {braces} and "quotes"', parties=[{"company": "Acme $today"}, {}])

    prompt = nda.build_system_prompt(form, date(2026, 10, 21))

    assert "Today is Wednesday, 2026-10-21." in prompt
    assert "whole number from 1 to 99" in prompt
    assert '"purpose": "Use {braces} and \\"quotes\\""' in prompt
    assert '"company": "Acme $today"' in prompt  # user text is not substituted
    assert '"party2": {' in prompt
    assert "language of the user's latest message" in prompt


def test_new_form_matches_the_frontend_defaults():
    form = nda.new_form(date(2026, 10, 21))
    assert form.purpose == nda.DEFAULT_PURPOSE
    assert form.effective_date == "2026-10-21"
    assert form.parties == [nda.Party(), nda.Party()]


def test_system_prompt_offers_the_other_documents():
    prompt = nda.build_system_prompt(_form(), date(2026, 10, 21), catalog='  - "csa": CSA')

    assert '  - "csa": CSA' in prompt
    assert "set switch_to to its id" in prompt
    assert "The user has just chosen this document." not in prompt
    assert "The user has just chosen this document." in nda.build_system_prompt(
        _form(), date(2026, 10, 21), announce=True
    )
