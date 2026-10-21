/**
 * The generated Cover Page of a generic document (every document but the NDA):
 * one section per group of fields in documents.json, then the signature table.
 */

import { formatDate, pdfFileName, signatureRows, value, type CoverPage } from "./cover-page";
import type { GenericForm, GenericSpec } from "./documents";
import type { Run } from "./terms-parser";

const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export type GenericCoverPage = CoverPage & {
  title: string;
  intro: Run[];
  signingStatement: string;
  /** Column headings of the signature table, e.g. ["PROVIDER", "CUSTOMER"]. */
  partyLabels: [string, string];
};

function standardTermsLink(spec: GenericSpec, text: string): Run {
  return spec.standardsUrl ? { text, href: spec.standardsUrl } : { text };
}

export function buildGenericCoverPage(spec: GenericSpec, form: GenericForm): GenericCoverPage {
  const [first, second] = spec.partyRoles;
  return {
    title: spec.name,
    intro: [
      {
        text: `This ${spec.name} (the “Agreement”) is between the ${first} and the ${second} named below and consists of: (1) this Cover Page and (2) the `,
      },
      standardTermsLink(spec, `Common Paper ${spec.name} Standard Terms`),
      {
        text: " (“Standard Terms”). Capitalized terms used in the Standard Terms have the meanings given on this Cover Page. Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
      },
    ],
    sections: spec.sections.map((section) => ({
      heading: section.heading,
      lines: section.fields.map((field) => {
        const raw = form.values[field.key] ?? "";
        const text = field.type === "date" ? (formatDate(raw) ?? "") : raw;
        return {
          label: field.label,
          // Leaving an optional field empty is a valid final answer.
          value:
            field.optional && !text.trim()
              ? { text: "None.", filled: true }
              : value(text, `[${field.label}]`),
        };
      }),
    })),
    // Not every document has an Effective Date (the SLA, DPA and AI Addendum don't).
    signingStatement: `By signing this Cover Page, each party agrees to enter into this ${spec.name}.`,
    partyLabels: [first.toUpperCase(), second.toUpperCase()],
    signatureRows: signatureRows(form.parties),
  };
}

/** The CC BY 4.0 attribution that the generic templates do not include. */
export function attribution(spec: GenericSpec): Run[] {
  return [
    { text: "Based on the " },
    standardTermsLink(spec, `Common Paper ${spec.name} Standard Terms`),
    { text: ", free to use under " },
    { text: "CC BY 4.0", href: CC_BY },
    { text: "." },
  ];
}

/** e.g. `Pilot-Agreement-Acme-Globex.pdf`. */
export function genericPdfFileName(spec: GenericSpec, form: GenericForm): string {
  return pdfFileName(form, spec.name.replace(/[^A-Za-z0-9]+/g, "-"));
}
