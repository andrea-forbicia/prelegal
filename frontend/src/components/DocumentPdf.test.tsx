import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { emptyParty } from "@/lib/cover-page";
import { findSpec, newDraft, type GenericForm, type GenericSpec } from "@/lib/documents";
import { attribution, buildGenericCoverPage } from "@/lib/generic-cover-page";
import { loadCatalog } from "@/lib/templates";
import { DocumentPdf } from "./DocumentPdf";
import { registerPdfFonts } from "./pdf-fonts";

describe("DocumentPdf", async () => {
  registerPdfFonts(path.join(process.cwd(), "public", "fonts"));
  const catalog = await loadCatalog();

  // The DPA is the deepest template; Software License has a heading without a span.
  it.each(["dpa", "software-license", "partnership"])("renders %s to a PDF", async (id) => {
    const spec = findSpec(catalog.documents, id) as GenericSpec;
    const form = newDraft(spec, "2026-10-21").form as GenericForm;
    form.parties = [{ ...emptyParty, company: "Łódź Sp. z o.o." }, { ...emptyParty }];

    const buffer = await renderToBuffer(
      <DocumentPdf
        coverPage={buildGenericCoverPage(spec, form)}
        terms={catalog.terms[id]}
        footer={attribution(spec)}
      />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const raw = buffer.toString("latin1");
    expect(raw).toMatch(/NotoSerif/);
    expect(raw).not.toMatch(/\/BaseFont \/(Times|Helvetica)/);
  });
});
