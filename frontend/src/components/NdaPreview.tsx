import { Fragment } from "react";
import {
  COVER_PAGE_INTRO,
  COVER_PAGE_SIGNING_STATEMENT,
  COVER_PAGE_TITLE,
  type CoverPage,
  type Value,
} from "@/lib/cover-page";
import type { Inline, StandardTerms } from "@/lib/standard-terms";

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    switch (part.kind) {
      case "bold":
        return <strong key={i}>{part.text}</strong>;
      case "term":
        return (
          <a key={i} href="#cover-page" className="underline decoration-slate-400 underline-offset-2">
            {part.text}
          </a>
        );
      case "link":
        return (
          <a key={i} href={part.href} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {part.text}
          </a>
        );
      default:
        return <Fragment key={i}>{part.text}</Fragment>;
    }
  });
}

function ValueText({ value }: { value: Value }) {
  return value.filled ? (
    <span className="whitespace-pre-line">{value.text}</span>
  ) : (
    <span className="rounded bg-amber-100 px-1 text-amber-800">{value.text}</span>
  );
}

export function NdaPreview({
  coverPage,
  standardTerms,
}: {
  coverPage: CoverPage;
  standardTerms: StandardTerms;
}) {
  return (
    <article className="rounded-lg bg-white px-6 py-8 font-serif text-[15px] leading-relaxed shadow-sm ring-1 ring-slate-200 sm:px-10">
      <div id="cover-page" className="space-y-5">
        <h2 className="text-center text-2xl font-bold">{COVER_PAGE_TITLE}</h2>
        <p>
          <InlineText parts={COVER_PAGE_INTRO} />
        </p>

        {coverPage.sections.map((section) => (
          <div key={section.heading}>
            <h3 className="font-sans text-base font-semibold">{section.heading}</h3>
            {section.hint && (
              <p className="font-sans text-xs text-slate-500">{section.hint}</p>
            )}
            {section.lines.map((line, i) => (
              <p key={i}>
                {line.label && <>{line.label}: </>}
                <ValueText value={line.value} />
              </p>
            ))}
          </div>
        ))}

        <p>{COVER_PAGE_SIGNING_STATEMENT}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse font-sans text-sm">
            <thead>
              <tr>
                <th className="w-1/4 border border-slate-300 p-2" />
                <th className="border border-slate-300 p-2">PARTY 1</th>
                <th className="border border-slate-300 p-2">PARTY 2</th>
              </tr>
            </thead>
            <tbody>
              {coverPage.signatureRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border border-slate-300 p-2 text-left align-top font-medium">
                    {row.label}
                    {row.hint && (
                      <span className="block text-xs font-normal text-slate-500">{row.hint}</span>
                    )}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={i} className="h-10 border border-slate-300 p-2 text-center align-top">
                      {value && <ValueText value={value} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="my-10 border-slate-300" />

      <div className="space-y-4">
        <h2 className="text-center text-2xl font-bold">{standardTerms.title}</h2>
        <ol className="space-y-4">
          {standardTerms.clauses.map((clause) => (
            <li key={clause.number}>
              {clause.number}. <strong>{clause.title}</strong>.{" "}
              <InlineText parts={clause.body} />
            </li>
          ))}
        </ol>
        <p className="pt-4 text-sm text-slate-600">
          <InlineText parts={standardTerms.footer} />
        </p>
      </div>
    </article>
  );
}
