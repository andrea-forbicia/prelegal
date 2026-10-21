"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatError, GREETING, sendChat, type ChatMessage } from "@/lib/chat";
import { buildCoverPage, pdfFileName, todayIso, type NdaForm } from "@/lib/cover-page";
import {
  findSpec,
  newDraft,
  startMessage,
  type Catalog,
  type DocumentSpec,
  type Draft,
  type GenericForm,
} from "@/lib/documents";
import {
  attribution,
  buildGenericCoverPage,
  genericPdfFileName,
} from "@/lib/generic-cover-page";
import { DocumentChat } from "./DocumentChat";
import { DocumentPreview } from "./DocumentPreview";
import { NdaPreview } from "./NdaPreview";

/** Everything the preview and the PDF need for the current draft. */
function buildView(catalog: Catalog, draft: Draft | null) {
  const spec = draft && findSpec(catalog.documents, draft.id);
  if (!draft || !spec) return null;
  if (spec.kind === "nda") {
    const form = draft.form as NdaForm;
    return {
      kind: "nda" as const,
      coverPage: buildCoverPage(form),
      standardTerms: catalog.ndaTerms,
      fileName: pdfFileName(form),
    };
  }
  const form = draft.form as GenericForm;
  const terms = catalog.terms[spec.id];
  return {
    kind: "generic" as const,
    coverPage: buildGenericCoverPage(spec, form),
    terms,
    footer: terms.footer.length ? terms.footer : attribution(spec),
    fileName: genericPdfFileName(spec, form),
  };
}

export function DocumentCreator({ catalog }: { catalog: Catalog }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  // Abort an in-flight turn when the page unmounts.
  useEffect(() => () => requestRef.current?.abort(), []);

  const view = useMemo(() => buildView(catalog, draft), [catalog, draft]);

  async function handleSend(text: string): Promise<boolean> {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages(history);
    setPending(true);
    setChatError(null);
    try {
      const turn = await sendChat(history, draft, todayIso(), controller.signal);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      setDraft(turn.document);
      return true;
    } catch (err) {
      if (controller.signal.aborted) return true;
      console.error(err);
      setMessages(messages);
      setChatError(err instanceof ChatError ? err.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  /** Picking from the list needs no LLM call: the next chat turn sends the new draft. */
  function choose(spec: DocumentSpec) {
    // A turn in flight would overwrite the choice when it returns.
    if (pending || spec.id === draft?.id) return;
    // As when the assistant switches documents, the parties carry over.
    setDraft(newDraft(spec, todayIso(), draft?.form.parties));
    setMessages((current) => [...current, { role: "assistant", content: startMessage(spec) }]);
  }

  async function handleDownload() {
    if (!view) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const [{ pdf }, { registerPdfFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf-fonts"),
      ]);
      registerPdfFonts(`${window.location.origin}/fonts`);
      let element;
      if (view.kind === "nda") {
        const { NdaPdf } = await import("./NdaPdf");
        element = <NdaPdf coverPage={view.coverPage} standardTerms={view.standardTerms} />;
      } else {
        const { DocumentPdf } = await import("./DocumentPdf");
        element = <DocumentPdf coverPage={view.coverPage} terms={view.terms} footer={view.footer} />;
      }
      const blob = await pdf(element).toBlob();

      // Attach the link and revoke the URL later: some browsers (Safari,
      // older Firefox) start the download asynchronously after click().
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = view.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
      setDownloadError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold text-[#032147]">Prelegal</h1>
            <p className="text-sm text-slate-600">
              Chat with the assistant to draft an agreement, review it, and download it as a PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Document"
              value={draft?.id ?? ""}
              disabled={pending}
              onChange={(event) => {
                const spec = findSpec(catalog.documents, event.target.value);
                if (spec) choose(spec);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#209dd7] focus:outline-none focus:ring-1 focus:ring-[#209dd7] disabled:opacity-60"
            >
              <option value="" disabled>
                Choose a document…
              </option>
              {catalog.documents.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!view || downloading}
              className="rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white hover:bg-[#5f2e76] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>
        </div>
        {downloadError && (
          <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm text-red-700 sm:px-6">
            {downloadError}
          </p>
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Drafting assistant" className="h-[70vh] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start">
          <DocumentChat messages={messages} pending={pending} error={chatError} onSend={handleSend} />
        </section>
        <section aria-label="Agreement preview">
          {view?.kind === "nda" && (
            <NdaPreview coverPage={view.coverPage} standardTerms={view.standardTerms} />
          )}
          {view?.kind === "generic" && (
            <DocumentPreview coverPage={view.coverPage} terms={view.terms} footer={view.footer} />
          )}
          {!view && (
            <DocumentChooser documents={catalog.documents} disabled={pending} onChoose={choose} />
          )}
        </section>
      </main>
    </div>
  );
}

/** Shown before a document is chosen: every document Prelegal can draft. */
function DocumentChooser({
  documents,
  disabled,
  onChoose,
}: {
  documents: DocumentSpec[];
  disabled: boolean;
  onChoose: (spec: DocumentSpec) => void;
}) {
  return (
    <div className="rounded-lg bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold text-[#032147]">What would you like to draft?</h2>
      <p className="mt-1 text-sm text-[#888888]">
        Describe your situation in the chat, or pick a document. The preview will appear here.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {documents.map((spec) => (
          <li key={spec.id}>
            <button
              type="button"
              onClick={() => onChoose(spec)}
              disabled={disabled}
              className="h-full w-full rounded-md border border-slate-200 p-4 text-left hover:border-[#209dd7] hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-[#209dd7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block font-medium text-[#032147]">{spec.name}</span>
              <span className="mt-1 block text-sm text-slate-600">{spec.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
