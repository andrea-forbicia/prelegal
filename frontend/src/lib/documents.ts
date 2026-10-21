/**
 * The documents Prelegal can draft, as defined in documents.json at the
 * repository root (read at build time; the backend reads the same file), and
 * the draft the user is working on.
 */

import { defaultNdaForm, emptyParty, type NdaForm, type Party } from "./cover-page";
import type { StandardTerms } from "./standard-terms";
import type { TermsDoc } from "./terms-parser";

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "longtext" | "date";
  description: string;
  /** A blank optional field is a valid final answer ("None." on the cover page). */
  optional?: boolean;
};

export type SectionSpec = { heading: string; fields: FieldSpec[] };

type SpecBase = { id: string; name: string; template: string; summary: string; useFor: string };

export type NdaSpec = SpecBase & { kind: "nda" };

export type GenericSpec = SpecBase & {
  kind: "generic";
  standardsUrl?: string;
  partyRoles: [string, string];
  sections: SectionSpec[];
};

export type DocumentSpec = NdaSpec | GenericSpec;

/** A generic document's form: one value per field key ("" when not filled in). */
export type GenericForm = { values: Record<string, string>; parties: [Party, Party] };

/** The document being drafted; the same shape the chat API sends and returns. */
export type Draft = { id: string; form: NdaForm | GenericForm };

/** Everything the page needs, parsed at build time. */
export type Catalog = {
  documents: DocumentSpec[];
  ndaTerms: StandardTerms;
  /** The Standard Terms of each generic document, by id. */
  terms: Record<string, TermsDoc>;
};

export function findSpec(documents: DocumentSpec[], id: string): DocumentSpec | undefined {
  return documents.find((spec) => spec.id === id);
}

export function fields(spec: GenericSpec): FieldSpec[] {
  return spec.sections.flatMap((section) => section.fields);
}

/**
 * A fresh draft, as the backend creates one (`new_form` in
 * backend/app/documents): dates default to today, and `parties` carry over
 * from the previous document when the user switches.
 */
export function newDraft(spec: DocumentSpec, today: string, parties?: [Party, Party]): Draft {
  const copied: [Party, Party] = parties
    ? [{ ...parties[0] }, { ...parties[1] }]
    : [{ ...emptyParty }, { ...emptyParty }];
  if (spec.kind === "nda") {
    return { id: spec.id, form: { ...defaultNdaForm(today), parties: copied } };
  }
  const values = Object.fromEntries(
    fields(spec).map((field) => [field.key, field.type === "date" ? today : ""]),
  );
  return { id: spec.id, form: { values, parties: copied } };
}

/** The assistant's first question after the user picks a document from the list. */
export function startMessage(spec: DocumentSpec): string {
  if (spec.kind === "nda") {
    return `Let's draft a ${spec.name}. Who are the two parties, and why will they share confidential information?`;
  }
  const [first, second] = spec.partyRoles;
  return `Let's draft a ${spec.name}. Who is the ${first}, and who is the ${second}?`;
}
