"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import {
  createAutosaver,
  createDocument,
  getDocument,
  updateDocument,
  type SaveStatus,
} from "@/lib/saved-documents";
import { Disclaimer } from "./Disclaimer";
import { DocumentChat } from "./DocumentChat";
import { DocumentPreview } from "./DocumentPreview";
import { NdaPreview } from "./NdaPreview";
import { Alert, Button, Loading, Spinner, buttonClass } from "./ui";

/** Everything the preview and the PDF need for the current draft. */
function buildView(catalog: Catalog, draft: Draft | null) {
  const spec = draft && findSpec(catalog.documents, draft.id);
  if (!draft || !spec) return null;
  if (spec.kind === "nda") {
    const form = draft.form as NdaForm;
    return {
      kind: "nda" as const,
      name: spec.name,
      coverPage: buildCoverPage(form),
      standardTerms: catalog.ndaTerms,
      fileName: pdfFileName(form),
    };
  }
  const form = draft.form as GenericForm;
  const terms = catalog.terms[spec.id];
  return {
    kind: "generic" as const,
    name: spec.name,
    coverPage: buildGenericCoverPage(spec, form),
    terms,
    footer: terms.footer.length ? terms.footer : attribution(spec),
    fileName: genericPdfFileName(spec, form),
  };
}

const SAVE_STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save. Will retry on your next change.",
};

export function DocumentCreator({ catalog }: { catalog: Catalog }) {
  const idParam = useSearchParams().get("id");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const [saver] = useState(() =>
    createAutosaver({
      create: createDocument,
      update: updateDocument,
      onStatus: setSaveStatus,
      // Put the new document's id in the URL, so a reload reopens it. Not if
      // the user has left the editor while the first save was running.
      onSaved: (id) => {
        const url = new URL(window.location.href);
        if (url.pathname === "/" && url.searchParams.get("id") !== String(id)) {
          window.history.replaceState(null, "", `/?id=${id}`);
        }
      },
    }),
  );

  // Abort an in-flight turn when the page unmounts.
  useEffect(() => () => requestRef.current?.abort(), []);

  // Open the saved document in ?id=, or start afresh when it goes away
  // ("New document"). The autosaver's own URL update is not a change.
  useEffect(() => {
    setLoading(false);
    setLoadError(null);
    const id = idParam === null ? null : Number(idParam);
    if (id !== null && id === saver.id) return;

    function startFresh() {
      saver.reset();
      setDraft(null);
      setMessages([GREETING]);
    }

    requestRef.current?.abort();
    setPending(false);
    setChatError(null);
    if (id === null) {
      startFresh();
      return;
    }
    const notFound = "We couldn't open that document. It may have been deleted.";
    if (!Number.isInteger(id) || id < 1) {
      startFresh();
      setLoadError(notFound);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getDocument(id)
      .then((saved) => {
        if (cancelled) return;
        saver.open(saved.id);
        setDraft(saved.document);
        setMessages(saved.messages.length ? saved.messages : [GREETING]);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        startFresh();
        setLoadError(notFound);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [idParam, saver]);

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
      const updated: ChatMessage[] = [...history, { role: "assistant", content: turn.reply }];
      setMessages(updated);
      setDraft(turn.document);
      // Nothing to save until a document is chosen.
      if (turn.document) saver.save({ document: turn.document, messages: updated });
      return true;
    } catch (err) {
      if (controller.signal.aborted) return true;
      console.error(err);
      setMessages(messages);
      setChatError(err instanceof ChatError ? err.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  /** Picking from the list needs no LLM call: the next chat turn sends the new draft. */
  function choose(spec: DocumentSpec) {
    // A turn in flight would overwrite the choice when it returns.
    if (pending || loading || spec.id === draft?.id) return;
    // As when the assistant switches documents, the parties carry over.
    const next = newDraft(spec, todayIso(), draft?.form.parties);
    const updated: ChatMessage[] = [...messages, { role: "assistant", content: startMessage(spec) }];
    setDraft(next);
    setMessages(updated);
    saver.save({ document: next, messages: updated });
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

  if (loading) return <Loading label="Opening your document…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-brand-navy">{view?.name ?? "New document"}</h1>
          <p aria-live="polite" className={`text-xs ${saveStatus === "error" ? "text-red-700" : "text-slate-600"}`}>
            {view ? SAVE_STATUS_TEXT[saveStatus] || "Saved automatically as you go" : "Choose a document or describe what you need"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Document"
            value={draft?.id ?? ""}
            disabled={pending}
            onChange={(event) => {
              const spec = findSpec(catalog.documents, event.target.value);
              if (spec) choose(spec);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60"
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
          <Button onClick={handleDownload} disabled={!view || downloading}>
            {downloading ? <Spinner /> : <DownloadIcon />}
            {downloading ? "Generating PDF…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert action={<Link href="/documents/" className={buttonClass("secondary")}>My documents</Link>}>
          {loadError}
        </Alert>
      )}
      {downloadError && <Alert>{downloadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          aria-label="Drafting assistant"
          className="flex h-[70vh] flex-col gap-2 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:self-start"
        >
          <div className="min-h-0 flex-1">
            <DocumentChat messages={messages} pending={pending} error={chatError} onSend={handleSend} />
          </div>
          <Disclaimer variant="note" />
        </section>
        <section aria-label="Agreement preview" className="space-y-4">
          {view && <Disclaimer variant="box" />}
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
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.28 8.47a.75.75 0 0 0-1.06 1.06l4.25 4.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 1 0-1.06-1.06l-2.97 2.97V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
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
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-navy">What would you like to draft?</h2>
      <p className="mt-1 text-sm text-brand-gray">
        Describe your situation in the chat, or pick a document. The preview will appear here.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {documents.map((spec) => (
          <li key={spec.id}>
            <button
              type="button"
              onClick={() => onChoose(spec)}
              disabled={disabled}
              className="h-full w-full rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-brand-primary hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block font-medium text-brand-navy">{spec.name}</span>
              <span className="mt-1 block text-sm text-slate-600">{spec.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
