import json
import re
from pathlib import Path

import pytest

from app.documents import registry

ROOT = Path(__file__).resolve().parents[2]
SPAN = re.compile(r'<span class="\w+_link"[^>]*>([^<]+)</span>')


def _normalize(term: str) -> str:
    """'Provider’s' -> 'provider', 'Subscription Periods' -> 'subscription period'."""
    term = re.sub(r"['’]s$", "", term.strip()).lower()
    return term.removesuffix("s")


def test_all_documents_load_with_unique_ids():
    documents = registry.documents()
    assert len(documents) == 11
    assert list(documents)[0] == "mutual-nda"
    assert "Mutual-NDA-coverpage.md" not in {doc.template for doc in documents.values()}


def test_every_template_is_in_the_catalog_and_on_disk():
    catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    filenames = {entry["filename"] for entry in catalog["templates"]}
    for doc in registry.documents().values():
        assert doc.template in filenames
        assert (ROOT / "templates" / doc.template).is_file()


@pytest.mark.parametrize(
    ("document_id", "roles"),
    [
        ("csa", ("Provider", "Customer")),
        ("baa", ("Provider", "Company")),
        ("design-partner", ("Provider", "Partner")),
        ("partnership", ("Company", "Partner")),
    ],
)
def test_party_roles(document_id, roles):
    assert registry.get(document_id).party_roles == roles


@pytest.mark.parametrize(
    "spec",
    [doc for doc in registry.documents().values() if doc.kind == "generic"],
    ids=lambda spec: spec.id,
)
def test_every_template_variable_is_a_field_or_a_party(spec):
    """Catches a variable that the curated fields in documents.json leave out."""
    text = (ROOT / "templates" / spec.template).read_text(encoding="utf-8")
    known = {_normalize(field.label) for field in spec.fields}
    known |= {_normalize(role) for role in spec.party_roles}
    known.add(_normalize("Notice Address"))  # A party field.

    variables = {_normalize(term) for term in SPAN.findall(text)}

    assert variables - known == set()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("csa", "csa"),
        (" CSA ", "csa"),
        ("Cloud Service Agreement", "csa"),
        ("design partner", "design-partner"),
        ("employment contract", None),
        ("", None),
        (None, None),
    ],
)
def test_resolve_id_tolerates_near_misses(raw, expected):
    assert registry.resolve_id(raw) == expected


def test_catalog_text_lists_ids_and_can_exclude_one():
    text = registry.catalog_text(exclude="csa")
    assert '"mutual-nda": Mutual Non-Disclosure Agreement.' in text
    assert '"csa"' not in text
    assert len(text.splitlines()) == 10
