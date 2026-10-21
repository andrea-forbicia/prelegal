/**
 * Parses the nested Common Paper Standard Terms (CSA.md, DPA.md, ...) into a
 * tree that both the HTML preview and the PDF renderer consume.
 *
 * The templates are Markdown ordered lists nested by 4-space indents:
 *
 *     1. <span class="header_2" id="1">Uptime</span>
 *         1. <span class="header_3" id="1.1">Target Uptime.</span>  Body text…
 *             a. Lettered item…
 *                 i. Roman item (DPA only)…
 *
 * Variables are `<span class="*_link">Name</span>` and stay references to the
 * Cover Page. Like the NDA parser, this one throws on anything it does not
 * recognise, so a template change fails the build instead of dropping text.
 */

/** A run of text with one style; `term` refers to a Cover Page value. */
export type Run = { text: string; bold?: boolean; term?: boolean; href?: string };

export type TermNode = {
  /** "1.", "1.1", "(a)" or "(i)". */
  label: string;
  heading?: string;
  runs: Run[];
  children: TermNode[];
};

export type TermsDoc = { title: string; sections: TermNode[]; footer: Run[] };

const ITEM = /^( *)(\d+|[a-z]+)\.\s+(.*)$/;
const HEADING = /^<span class="header_\d"(?: id="[^"]*")?>(.*?)<\/span>\s*(.*)$/;
// Left-to-right marks and zero-width characters (DPA has one) would break PDF text.
const INVISIBLE = /[​-‏⁠﻿]/g;

const TOKEN =
  /\*\*|<span class="\w+_link"(?: id="[^"]*")?>|<span id="[^"]*">|<\/span>|<(https?:\/\/[^>\s]+)>|\[([^\]]+)\]\(([^)\s]+)\)|<[^>]*>/g;

/** Splits inline Markdown and HTML spans into styled runs. */
export function parseRuns(source: string): Run[] {
  const runs: Run[] = [];
  // Each open span is a term (variable) or transparent (an anchor id).
  const spans: boolean[] = [];
  let bold = false;
  let cursor = 0;

  const push = (run: Run) => {
    const last = runs.at(-1);
    if (last && !last.href && !run.href && last.bold === run.bold && last.term === run.term) {
      last.text += run.text;
    } else {
      runs.push(run);
    }
  };
  const pushText = (text: string) => {
    if (!text) return;
    const run: Run = { text };
    if (bold) run.bold = true;
    if (spans.includes(true)) run.term = true;
    push(run);
  };

  for (const match of source.matchAll(TOKEN)) {
    pushText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const [token, autolink, linkText, href] = match;

    if (token === "**") {
      bold = !bold;
    } else if (token === "</span>") {
      if (spans.pop() === undefined) throw new Error(`Unbalanced </span> in: "${source.slice(0, 80)}"`);
    } else if (token.startsWith("<span")) {
      spans.push(token.includes("_link"));
    } else if (autolink) {
      push({ text: autolink, href: autolink });
    } else if (linkText) {
      // One template link has no scheme ("commonpaper.com/…").
      push({ text: linkText, href: /^https?:\/\//.test(href) ? href : `https://${href}` });
    } else {
      throw new Error(`Unexpected markup "${token}" in: "${source.slice(0, 80)}"`);
    }
  }
  pushText(source.slice(cursor));

  if (bold || spans.length) throw new Error(`Unclosed markup in: "${source.slice(0, 80)}"`);
  return runs;
}

/** Plain text of some runs, e.g. to compare against the template. */
export function runsText(runs: Run[]): string {
  return runs.map((run) => run.text).join("");
}

function label(depth: number, count: number, marker: string, parents: number[]): string {
  if (depth === 0) return `${count}.`;
  if (depth === 1) return `${parents[0]}.${count}`;
  return `(${marker})`; // Lettered and roman items are written out in the template.
}

export function parseTerms(markdown: string): TermsDoc {
  let title = "";
  const sections: TermNode[] = [];
  const footer: string[] = [];
  // The open node at each depth, and how many items each depth has had.
  const stack: TermNode[] = [];
  const counts: number[] = [];
  // Body text of the latest node, joined once the node is complete.
  let body: string[] = [];

  const flush = () => {
    const node = stack.at(-1);
    if (node && body.length) node.runs.push(...parseRuns(body.join(" ")));
    body = [];
  };

  for (const rawLine of markdown.replace(INVISIBLE, "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    if (line.startsWith("# ") && !title && !stack.length) {
      title = line.slice(2).trim();
      continue;
    }

    const item = ITEM.exec(line);
    if (item) {
      if (footer.length) throw new Error(`Item after the footer: "${line.slice(0, 80)}"`);
      const [, indent, marker, rest] = item;
      if (indent.length % 4 !== 0) throw new Error(`Unexpected indent: "${line.slice(0, 80)}"`);
      const depth = indent.length / 4;
      if (depth > stack.length) throw new Error(`Item nested too deep: "${line.slice(0, 80)}"`);

      flush();
      stack.length = depth;
      counts.length = depth + 1;
      counts[depth] = (counts[depth] ?? 0) + 1;

      const node: TermNode = { label: label(depth, counts[depth], marker, counts), runs: [], children: [] };
      const heading = HEADING.exec(rest);
      if (heading) {
        node.heading = runsText(parseRuns(heading[1])).trim();
        body.push(heading[2].trim());
      } else if (depth === 0) {
        node.heading = runsText(parseRuns(rest)).trim(); // e.g. "11. Definitions" without a span.
      } else {
        body.push(rest.trim());
      }
      (depth === 0 ? sections : stack[depth - 1].children).push(node);
      stack.push(node);
    } else if (stack.length && /^\s/.test(line) && !footer.length) {
      body.push(line.trim()); // A wrapped line of the current item.
    } else if (stack.length) {
      flush();
      footer.push(line.trim());
    } else {
      throw new Error(`Unrecognized line in Standard Terms: "${line.slice(0, 80)}"`);
    }
  }
  flush();

  if (!title || !sections.length) throw new Error("No title or sections found in Standard Terms");
  return { title, sections, footer: footer.length ? parseRuns(footer.join(" ")) : [] };
}
