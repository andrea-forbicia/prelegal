"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteDocument,
  formatCompanies,
  formatUpdated,
  listDocuments,
  type SavedSummary,
} from "@/lib/saved-documents";
import { Alert, Button, Loading, Spinner, buttonClass } from "./ui";

function DocumentRow({ doc, onDeleted }: { doc: SavedSummary; onDeleted: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(doc.id);
      onDeleted(doc.id);
    } catch (err) {
      console.error(err);
      setError("Could not delete this document. Please try again.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/?id=${doc.id}`} className="font-medium text-brand-navy hover:underline">
          {doc.name}
        </Link>
        <p className="truncate text-sm text-slate-600">{formatCompanies(doc.companies)}</p>
        <p className="text-xs text-brand-gray">Updated {formatUpdated(doc.updatedAt)}</p>
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm text-slate-600">Delete this document?</span>
            {/* Focus moves here, so keyboard users land on the confirmation. */}
            <Button variant="danger" onClick={handleDelete} disabled={deleting} autoFocus>
              {deleting && <Spinner />}
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Link href={`/?id=${doc.id}`} aria-label={`Open ${doc.name}`} className={buttonClass("secondary")}>
              Open
            </Link>
            <Button variant="ghost" aria-label={`Delete ${doc.name}`} onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** The signed-in user's saved documents, newest first. */
export function DocumentList() {
  const [documents, setDocuments] = useState<SavedSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    setError(null);
    listDocuments()
      .then(setDocuments)
      .catch((err) => {
        console.error(err);
        setError("Could not load your documents.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDeleted(id: number) {
    setDocuments((current) => current?.filter((d) => d.id !== id) ?? null);
    // The deleted row's buttons are gone: keep keyboard focus on the page.
    headingRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-brand-navy focus:outline-none">
            My documents
          </h1>
          <p className="text-sm text-brand-gray">Every document you draft is saved here automatically.</p>
        </div>
        <Link href="/" className={buttonClass("primary")}>
          New document
        </Link>
      </div>

      {error ? (
        <Alert action={<Button variant="secondary" onClick={load}>Try again</Button>}>{error}</Alert>
      ) : documents === null ? (
        <Loading label="Loading your documents…" />
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <h2 className="font-semibold text-brand-navy">No documents yet</h2>
          <p className="mt-1 text-sm text-brand-gray">
            Tell the assistant what you need and your first draft will appear here.
          </p>
          <Link href="/" className={`${buttonClass("primary")} mt-6`}>
            Draft your first document
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
