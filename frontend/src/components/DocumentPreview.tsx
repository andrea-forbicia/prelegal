import { Fragment, type ReactNode } from "react";
import type { Value } from "@/lib/cover-page";
import type { GenericCoverPage } from "@/lib/generic-cover-page";
import type { Run, TermNode, TermsDoc } from "@/lib/terms-parser";

function RunText({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    let content: ReactNode = run.text;
    if (run.href) {
      content = (
        <a href={run.href} target="_blank" rel="noreferrer" className="text-blue-700 underline">
          {content}
        </a>
      );
    } else if (run.term) {
      // A variable whose value is on the Cover Page.
      content = (
        <a href="#cover-page" className="underline decoration-slate-400 underline-offset-2">
          {content}
        </a>
      );
    }
    return <Fragment key={i}>{run.bold ? <strong>{content}</strong> : content}</Fragment>;
  });
}

function ValueText({ value }: { value: Value }) {
  return value.filled ? (
    <span className="whitespace-pre-line">{value.text}</span>
  ) : (
    <span className="rounded bg-amber-100 px-1 text-amber-800">{value.text}</span>
  );
}

function Clauses({ nodes, depth }: { nodes: TermNode[]; depth: number }) {
  return (
    <ol className={`space-y-2 ${depth > 0 ? "mt-2 pl-6" : ""}`}>
      {nodes.map((node) => (
        <li key={node.label} className="list-none">
          {depth === 0 ? (
            <h3 className="font-sans text-base font-semibold">
              {node.label} {node.heading}
            </h3>
          ) : (
            <p>
              {node.label} {node.heading && <strong>{node.heading} </strong>}
              <RunText runs={node.runs} />
            </p>
          )}
          {depth === 0 && node.runs.length > 0 && (
            <p>
              <RunText runs={node.runs} />
            </p>
          )}
          {node.children.length > 0 && <Clauses nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ol>
  );
}

/** A generic document: the generated Cover Page, then its Standard Terms. */
export function DocumentPreview({
  coverPage,
  terms,
  footer,
}: {
  coverPage: GenericCoverPage;
  terms: TermsDoc;
  footer: Run[];
}) {
  return (
    <article className="rounded-lg bg-white px-6 py-8 font-serif text-[15px] leading-relaxed shadow-sm ring-1 ring-slate-200 sm:px-10">
      <div id="cover-page" className="space-y-5">
        <h2 className="text-center text-2xl font-bold">{coverPage.title}</h2>
        <p>
          <RunText runs={coverPage.intro} />
        </p>

        {coverPage.sections.map((section) => (
          <div key={section.heading} className="space-y-1">
            <h3 className="font-sans text-base font-semibold">{section.heading}</h3>
            {section.lines.map((line, i) => (
              <p key={i}>
                {line.label && <span className="font-sans text-sm font-medium">{line.label}: </span>}
                <ValueText value={line.value} />
              </p>
            ))}
          </div>
        ))}

        <p>{coverPage.signingStatement}</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse font-sans text-sm">
            <thead>
              <tr>
                <th className="w-1/4 border border-slate-300 p-2" />
                {coverPage.partyLabels.map((label) => (
                  <th key={label} className="border border-slate-300 p-2">
                    {label}
                  </th>
                ))}
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
        <h2 className="text-center text-2xl font-bold">{terms.title} Standard Terms</h2>
        <Clauses nodes={terms.sections} depth={0} />
        <p className="pt-4 text-sm text-slate-600">
          <RunText runs={footer} />
        </p>
      </div>
    </article>
  );
}
