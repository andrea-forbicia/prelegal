import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The repository-level templates/ directory (see catalog.json), shared with
 * the rest of Prelegal. Next.js runs with the frontend/ directory as cwd.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export function readStandardTermsMarkdown(): Promise<string> {
  return readFile(path.join(TEMPLATES_DIR, "Mutual-NDA.md"), "utf8");
}
