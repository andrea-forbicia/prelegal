/**
 * The Mutual NDA Cover Page: the form data the user fills in and the
 * structured Cover Page built from it. Wording follows
 * templates/Mutual-NDA-coverpage.md.
 */

import { parseInline, type Inline } from "./standard-terms";

export type Party = {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
};

export type NdaForm = {
  purpose: string;
  /** ISO date (YYYY-MM-DD), as produced by `<input type="date">`. */
  effectiveDate: string;
  mndaTerm: "expires" | "untilTerminated";
  mndaTermYears: number;
  confidentialityTerm: "years" | "perpetual";
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [Party, Party];
};

/** A Cover Page value; when `filled` is false, `text` is a placeholder. */
export type Value = { text: string; filled: boolean };

export type CoverPageSection = {
  heading: string;
  hint?: string;
  lines: { label?: string; value: Value }[];
};

/** A row of the signature table; `null` cells are left blank for signing. */
export type SignatureRow = {
  label: string;
  hint?: string;
  values: [Value | null, Value | null];
};

export type CoverPage = {
  sections: CoverPageSection[];
  signatureRows: SignatureRow[];
};

export const COVER_PAGE_TITLE = "Mutual Non-Disclosure Agreement";

export const COVER_PAGE_INTRO: Inline[] = parseInline(
  "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
);

export const COVER_PAGE_SIGNING_STATEMENT =
  "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.";

const emptyParty: Party = { company: "", name: "", title: "", noticeAddress: "" };

export function defaultNdaForm(effectiveDate = ""): NdaForm {
  return {
    purpose:
      "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate,
    mndaTerm: "expires",
    mndaTermYears: 1,
    confidentialityTerm: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    parties: [{ ...emptyParty }, { ...emptyParty }],
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Formats `2026-10-20` as `October 20, 2026` without timezone shifts. */
export function formatDate(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName} ${Number(day)}, ${year}` : null;
}

export function formatYears(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

function value(text: string, placeholder: string): Value {
  const trimmed = text.trim();
  return trimmed ? { text: trimmed, filled: true } : { text: placeholder, filled: false };
}

export function buildCoverPage(form: NdaForm): CoverPage {
  const effectiveDate = formatDate(form.effectiveDate);

  const mndaTerm =
    form.mndaTerm === "expires"
      ? `Expires ${formatYears(form.mndaTermYears)} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confidentialityTerm =
    form.confidentialityTerm === "years"
      ? `${formatYears(form.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  const partyRow = (
    label: string,
    field: keyof Party,
    placeholder: string,
    hint?: string,
  ): SignatureRow => ({
    label,
    hint,
    values: [
      value(form.parties[0][field], placeholder),
      value(form.parties[1][field], placeholder),
    ],
  });

  return {
    sections: [
      {
        heading: "Purpose",
        hint: "How Confidential Information may be used",
        lines: [{ value: value(form.purpose, "[Describe the purpose]") }],
      },
      {
        heading: "Effective Date",
        lines: [{ value: value(effectiveDate ?? "", "[Effective date]") }],
      },
      {
        heading: "MNDA Term",
        hint: "The length of this MNDA",
        lines: [{ value: { text: mndaTerm, filled: true } }],
      },
      {
        heading: "Term of Confidentiality",
        hint: "How long Confidential Information is protected",
        lines: [{ value: { text: confidentialityTerm, filled: true } }],
      },
      {
        heading: "Governing Law & Jurisdiction",
        lines: [
          { label: "Governing Law", value: value(form.governingLaw, "[Fill in state]") },
          {
            label: "Jurisdiction",
            value: value(form.jurisdiction, "[Fill in city or county and state]"),
          },
        ],
      },
      {
        heading: "MNDA Modifications",
        lines: [{ value: value(form.modifications, "None.") }],
      },
    ],
    signatureRows: [
      { label: "Signature", values: [null, null] },
      partyRow("Print Name", "name", "[Name]"),
      partyRow("Title", "title", "[Title]"),
      partyRow("Company", "company", "[Company]"),
      partyRow(
        "Notice Address",
        "noticeAddress",
        "[Email or postal address]",
        "Use either email or postal address",
      ),
      { label: "Date", values: [null, null] },
    ],
  };
}

/** e.g. `Mutual-NDA-Acme-Inc-Globex.pdf`. */
export function pdfFileName(form: NdaForm): string {
  const slug = (text: string) =>
    text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const companies = form.parties.map((p) => slug(p.company)).filter(Boolean);
  return ["Mutual-NDA", ...companies].join("-") + ".pdf";
}
