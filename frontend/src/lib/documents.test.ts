import { describe, expect, it } from "vitest";
import { defaultNdaForm, emptyParty } from "./cover-page";
import {
  fields,
  findSpec,
  newDraft,
  startMessage,
  type GenericForm,
  type GenericSpec,
} from "./documents";
import { attribution, buildGenericCoverPage, genericPdfFileName } from "./generic-cover-page";
import { loadCatalog, readDocumentSpecs } from "./templates";

const specs = await readDocumentSpecs();
const pilot = findSpec(specs, "pilot") as GenericSpec;
const acme = { ...emptyParty, company: "Acme Inc.", name: "Jo Doe" };

describe("documents.json", () => {
  it("lists the NDA and ten generic documents", () => {
    expect(specs.map((spec) => spec.kind)).toEqual(["nda", ...Array(10).fill("generic")]);
  });

  it("loads with every template parsed", async () => {
    const catalog = await loadCatalog();
    expect(catalog.ndaTerms.clauses).toHaveLength(11);
    expect(Object.keys(catalog.terms)).toHaveLength(10);
  });
});

describe("newDraft", () => {
  it("creates the NDA form the backend expects", () => {
    expect(newDraft(specs[0], "2026-10-21")).toEqual({
      id: "mutual-nda",
      form: defaultNdaForm("2026-10-21"),
    });
  });

  it("creates an empty generic form with dates set to today", () => {
    const { id, form } = newDraft(pilot, "2026-10-21");
    expect(id).toBe("pilot");
    expect(Object.keys((form as GenericForm).values)).toEqual(fields(pilot).map((f) => f.key));
    expect((form as GenericForm).values.effective_date).toBe("2026-10-21");
    expect((form as GenericForm).values.pilot_period).toBe("");
  });

  it("copies the parties it is given", () => {
    const parties: [typeof acme, typeof acme] = [acme, { ...emptyParty }];
    const { form } = newDraft(pilot, "2026-10-21", parties);
    expect(form.parties).toEqual(parties);
    expect(form.parties[0]).not.toBe(acme);
  });
});

describe("startMessage", () => {
  it("asks for the parties by their roles", () => {
    expect(startMessage(pilot)).toBe(
      "Let's draft a Pilot Agreement. Who is the Provider, and who is the Customer?",
    );
    expect(startMessage(specs[0])).toMatch(/Who are the two parties/);
  });
});

describe("buildGenericCoverPage", () => {
  const form: GenericForm = {
    values: {
      ...(newDraft(pilot, "").form as GenericForm).values,
      effective_date: "2026-11-02",
      pilot_period: "60 days",
    },
    parties: [acme, { ...emptyParty }],
  };
  const coverPage = buildGenericCoverPage(pilot, form);

  it("shows each field with its value or a placeholder", () => {
    const [orderForm] = coverPage.sections;
    expect(orderForm.heading).toBe("Order Form");
    const line = (label: string) => orderForm.lines.find((l) => l.label === label)?.value;
    expect(line("Effective Date")).toEqual({ text: "November 2, 2026", filled: true });
    expect(line("Pilot Period")).toEqual({ text: "60 days", filled: true });
    expect(line("Governing Law")).toEqual({ text: "[Governing Law]", filled: false });
  });

  it("shows None. for an empty optional field", () => {
    const addendum = findSpec(specs, "ai-addendum") as GenericSpec;
    const empty = newDraft(addendum, "").form as GenericForm;
    const lines = buildGenericCoverPage(addendum, empty).sections[0].lines;
    expect(lines.find((l) => l.label === "Training Data")?.value).toEqual({
      text: "None.",
      filled: true,
    });
    expect(lines.find((l) => l.label === "Agreement")?.value.filled).toBe(false);
  });

  it("labels the signature table with the party roles", () => {
    expect(coverPage.partyLabels).toEqual(["PROVIDER", "CUSTOMER"]);
    const company = coverPage.signatureRows.find((row) => row.label === "Company");
    expect(company?.values).toEqual([
      { text: "Acme Inc.", filled: true },
      { text: "[Company]", filled: false },
    ]);
  });

  it("links the Common Paper Standard Terms in the intro and the attribution", () => {
    const link = coverPage.intro.find((run) => run.href);
    expect(link).toEqual({
      text: "Common Paper Pilot Agreement Standard Terms",
      href: "https://commonpaper.com/standards/pilot-agreement/1.1",
    });
    expect(attribution(pilot).map((run) => run.text).join("")).toMatch(/CC BY 4\.0/);
  });

  it("names the PDF after the document and the companies", () => {
    expect(genericPdfFileName(pilot, form)).toBe("Pilot-Agreement-Acme-Inc.pdf");
  });
});
