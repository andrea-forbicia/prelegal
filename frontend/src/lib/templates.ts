import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog, DocumentSpec } from "./documents";
import { parseStandardTerms } from "./standard-terms";
import { parseTerms } from "./terms-parser";

/**
 * The repository root, home of the shared templates/ directory (see
 * catalog.json) and documents.json. Next.js runs with frontend/ as cwd.
 */
const ROOT = path.join(process.cwd(), "..");

export function readTemplate(filename: string): Promise<string> {
  return readFile(path.join(ROOT, "templates", filename), "utf8");
}

export function readStandardTermsMarkdown(): Promise<string> {
  return readTemplate("Mutual-NDA.md");
}

export async function readDocumentSpecs(): Promise<DocumentSpec[]> {
  const json = JSON.parse(await readFile(path.join(ROOT, "documents.json"), "utf8"));
  return json.documents;
}

/** Every document and its parsed Standard Terms; any template error fails the build. */
export async function loadCatalog(): Promise<Catalog> {
  const documents = await readDocumentSpecs();
  const terms: Catalog["terms"] = {};
  let ndaTerms: Catalog["ndaTerms"] | undefined;
  for (const spec of documents) {
    const markdown = await readTemplate(spec.template);
    if (spec.kind === "nda") ndaTerms = parseStandardTerms(markdown);
    else terms[spec.id] = parseTerms(markdown);
  }
  if (!ndaTerms) throw new Error("documents.json has no Mutual NDA");
  return { documents, ndaTerms, terms };
}
