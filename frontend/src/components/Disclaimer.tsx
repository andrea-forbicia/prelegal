import { DISCLAIMER } from "@/lib/disclaimer";

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.48 2.84a1.75 1.75 0 0 1 3.04 0l6.28 11.16A1.75 1.75 0 0 1 16.28 16.6H3.72a1.75 1.75 0 0 1-1.52-2.6L8.48 2.84ZM10 7a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7Zm0 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** The draft / legal review notice: a box above the preview, or a small note. */
export function Disclaimer({ variant }: { variant: "box" | "note" }) {
  if (variant === "note") {
    return <p className="text-xs leading-relaxed text-slate-600">{DISCLAIMER}</p>;
  }
  return (
    <div
      role="note"
      className="flex gap-2 rounded-md border border-brand-accent/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <WarningIcon />
      <p>
        <strong className="font-semibold">Draft for legal review. </strong>
        {DISCLAIMER}
      </p>
    </div>
  );
}
