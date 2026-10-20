import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildCoverPage, defaultNdaForm } from "@/lib/cover-page";
import { parseStandardTerms } from "@/lib/standard-terms";
import { readStandardTermsMarkdown } from "@/lib/templates";
import { NdaPdf } from "./NdaPdf";
import { registerPdfFonts } from "./pdf-fonts";

describe("NdaPdf", () => {
  it("renders the agreement, including non-Latin text, to a PDF", async () => {
    registerPdfFonts(path.join(process.cwd(), "public", "fonts"));
    const standardTerms = parseStandardTerms(await readStandardTermsMarkdown());
    const form = defaultNdaForm("2026-10-20");
    form.parties[0].company = "Łódź Sp. z o.o.";
    form.parties[1].company = "Ελληνική Εταιρεία";

    const buffer = await renderToBuffer(
      <NdaPdf coverPage={buildCoverPage(form)} standardTerms={standardTerms} />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // The Noto fonts are embedded instead of the WinAnsi-only built-ins.
    const raw = buffer.toString("latin1");
    expect(raw).toMatch(/NotoSerif/);
    expect(raw).toMatch(/NotoSans/);
    expect(raw).not.toMatch(/\/BaseFont \/(Times|Helvetica)/);
  });
});
