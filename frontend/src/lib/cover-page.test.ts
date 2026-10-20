import { describe, expect, it } from "vitest";
import {
  buildCoverPage,
  defaultNdaForm,
  formatDate,
  formatYears,
  pdfFileName,
  type NdaForm,
} from "./cover-page";

function filledForm(): NdaForm {
  const form = defaultNdaForm("2026-10-20");
  form.governingLaw = "Delaware";
  form.jurisdiction = "New Castle, DE";
  form.parties[0] = {
    company: "Acme, Inc.",
    name: "Jane Doe",
    title: "CEO",
    noticeAddress: "jane@acme.example",
  };
  form.parties[1] = {
    company: "Globex",
    name: "John Roe",
    title: "CTO",
    noticeAddress: "john@globex.example",
  };
  return form;
}

function section(form: NdaForm, heading: string) {
  const found = buildCoverPage(form).sections.find((s) => s.heading === heading);
  if (!found) throw new Error(`Missing section ${heading}`);
  return found;
}

describe("formatDate", () => {
  it("formats ISO dates without timezone shifts", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("rejects invalid input", () => {
    expect(formatDate("")).toBeNull();
    expect(formatDate("2026-13-01")).toBeNull();
  });
});

describe("formatYears", () => {
  it("pluralizes", () => {
    expect(formatYears(1)).toBe("1 year");
    expect(formatYears(3)).toBe("3 years");
  });
});

describe("buildCoverPage", () => {
  it("fills in the values entered by the user", () => {
    const form = filledForm();

    expect(section(form, "Effective Date").lines[0].value).toEqual({
      text: "October 20, 2026",
      filled: true,
    });
    expect(section(form, "MNDA Term").lines[0].value.text).toBe(
      "Expires 1 year from Effective Date.",
    );
    expect(section(form, "Governing Law & Jurisdiction").lines).toEqual([
      { label: "Governing Law", value: { text: "Delaware", filled: true } },
      {
        label: "Jurisdiction",
        value: { text: "New Castle, DE", filled: true },
      },
    ]);

    const company = buildCoverPage(form).signatureRows.find((r) => r.label === "Company");
    expect(company?.values).toEqual([
      { text: "Acme, Inc.", filled: true },
      { text: "Globex", filled: true },
    ]);
  });

  it("uses placeholders for empty fields", () => {
    const form = defaultNdaForm();
    form.purpose = "   ";

    expect(section(form, "Purpose").lines[0].value).toEqual({
      text: "[Describe the purpose]",
      filled: false,
    });
    expect(section(form, "Effective Date").lines[0].value.filled).toBe(false);
    expect(section(form, "Governing Law & Jurisdiction").lines[0].value).toEqual({
      text: "[Fill in state]",
      filled: false,
    });
  });

  it("describes the alternative term options", () => {
    const form = filledForm();
    form.mndaTerm = "untilTerminated";
    form.confidentialityTerm = "perpetual";

    expect(section(form, "MNDA Term").lines[0].value.text).toBe(
      "Continues until terminated in accordance with the terms of the MNDA.",
    );
    expect(section(form, "Term of Confidentiality").lines[0].value.text).toBe(
      "In perpetuity.",
    );

    form.confidentialityTerm = "years";
    form.confidentialityYears = 2;
    expect(section(form, "Term of Confidentiality").lines[0].value.text).toMatch(
      /^2 years from Effective Date, but in the case of trade secrets/,
    );
  });

  it("leaves signature and date cells blank for signing", () => {
    const rows = buildCoverPage(filledForm()).signatureRows;
    expect(rows.find((r) => r.label === "Signature")?.values).toEqual([null, null]);
    expect(rows.find((r) => r.label === "Date")?.values).toEqual([null, null]);
  });
});

describe("pdfFileName", () => {
  it("includes the company names", () => {
    expect(pdfFileName(filledForm())).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
  });

  it("falls back to a generic name", () => {
    expect(pdfFileName(defaultNdaForm())).toBe("Mutual-NDA.pdf");
  });
});
