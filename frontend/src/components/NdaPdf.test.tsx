import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildCoverPage, defaultNdaForm } from "@/lib/cover-page";
import { parseStandardTerms } from "@/lib/standard-terms";
import { readStandardTermsMarkdown } from "@/lib/templates";
import { NdaPdf } from "./NdaPdf";

describe("NdaPdf", () => {
  it("renders the agreement to a PDF", async () => {
    const standardTerms = parseStandardTerms(await readStandardTermsMarkdown());
    const coverPage = buildCoverPage(defaultNdaForm("2026-10-20"));

    const buffer = await renderToBuffer(
      <NdaPdf coverPage={coverPage} standardTerms={standardTerms} />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
