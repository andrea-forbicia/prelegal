/**
 * Parses the Common Paper Mutual NDA Standard Terms (templates/Mutual-NDA.md)
 * into a small structured model that both the HTML preview and the PDF
 * renderer consume, so the two outputs can never drift apart.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  /** A defined term that refers to a value on the Cover Page, e.g. "Purpose". */
  | { kind: "term"; text: string }
  | { kind: "link"; text: string; href: string };

export type Clause = {
  number: number;
  title: string;
  body: Inline[];
};

export type StandardTerms = {
  title: string;
  clauses: Clause[];
  footer: Inline[];
};

const INLINE_PATTERN =
  /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>|\[(.+?)\]\((.+?)\)/g;

// e.g. `1. **Introduction**. This Mutual Non-Disclosure Agreement ...`
const CLAUSE_PATTERN = /^(\d+)\.\s+\*\*(.+?)\*\*\.\s+(.*)$/;

export function parseInline(source: string): Inline[] {
  const result: Inline[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) {
      result.push({ kind: "text", text: source.slice(cursor, match.index) });
    }
    const [, bold, term, linkText, href] = match;
    if (bold !== undefined) {
      result.push({ kind: "bold", text: bold });
    } else if (term !== undefined) {
      result.push({ kind: "term", text: term });
    } else {
      result.push({ kind: "link", text: linkText, href });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    result.push({ kind: "text", text: source.slice(cursor) });
  }
  return result;
}

export function parseStandardTerms(markdown: string): StandardTerms {
  let title = "";
  const clauses: Clause[] = [];
  const footerLines: string[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }

    const clause = CLAUSE_PATTERN.exec(line);
    if (clause) {
      clauses.push({
        number: Number(clause[1]),
        title: clause[2],
        body: parseInline(clause[3]),
      });
    } else {
      footerLines.push(line);
    }
  }

  return { title, clauses, footer: parseInline(footerLines.join(" ")) };
}
