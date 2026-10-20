"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCoverPage, defaultNdaForm, pdfFileName, type NdaForm } from "@/lib/cover-page";
import type { StandardTerms } from "@/lib/standard-terms";
import { NdaFormFields } from "./NdaFormFields";
import { NdaPreview } from "./NdaPreview";

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function NdaCreator({ standardTerms }: { standardTerms: StandardTerms }) {
  const [form, setForm] = useState<NdaForm>(() => defaultNdaForm());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default the Effective Date to the user's today. Done after mount so the
  // statically rendered HTML does not carry the build date.
  useEffect(() => {
    setForm((current) =>
      current.effectiveDate ? current : { ...current, effectiveDate: todayIso() },
    );
  }, []);

  const coverPage = useMemo(() => buildCoverPage(form), [form]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const [{ pdf }, { NdaPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./NdaPdf"),
      ]);
      const blob = await pdf(
        <NdaPdf coverPage={coverPage} standardTerms={standardTerms} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(form);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold">Mutual NDA Creator</h1>
            <p className="text-sm text-slate-600">
              Fill in the key terms, review the agreement, and download it as a PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            {downloading ? "Generating PDF…" : "Download PDF"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm text-red-700 sm:px-6">
            {error}
          </p>
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Agreement details" className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <NdaFormFields form={form} onChange={setForm} />
        </section>
        <section aria-label="Agreement preview">
          <NdaPreview coverPage={coverPage} standardTerms={standardTerms} />
        </section>
      </main>
    </div>
  );
}
