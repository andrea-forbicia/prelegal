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

/**
 * Expects a `# Title`, numbered clauses and a final footer paragraph, each
 * separated by blank lines. Throws on any other paragraph so a template
 * change can't silently drop text from the agreement (the page is built
 * from the template, so the build fails instead).
 */
export function parseStandardTerms(markdown: string): StandardTerms {
  const paragraphs = markdown
    .split(/\r?\n\s*\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .join(" ")
        .trim(),
    )
    .filter(Boolean);

  let title = "";
  const clauses: Clause[] = [];
  let footer: Inline[] = [];

  paragraphs.forEach((paragraph, index) => {
    if (paragraph.startsWith("# ")) {
      title = paragraph.slice(2).trim();
      return;
    }

    const clause = CLAUSE_PATTERN.exec(paragraph);
    if (clause) {
      clauses.push({
        number: Number(clause[1]),
        title: clause[2],
        body: parseInline(clause[3]),
      });
    } else if (index === paragraphs.length - 1 && clauses.length > 0) {
      footer = parseInline(paragraph);
    } else {
      throw new Error(`Unrecognized paragraph in Standard Terms: "${paragraph.slice(0, 80)}"`);
    }
  });

  if (clauses.length === 0) {
    throw new Error("No clauses found in Standard Terms");
  }
  return { title, clauses, footer };
}
