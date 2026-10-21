import { describe, expect, it } from "vitest";
import type { GenericSpec } from "./documents";
import { parseRuns, parseTerms, runsText, type TermNode } from "./terms-parser";
import { readDocumentSpecs, readTemplate } from "./templates";

describe("parseRuns", () => {
  it("styles variables, bold text (even around variables) and links", () => {
    expect(
      parseRuns(
        '**Liability is capped at the <span class="keyterms_link">General Cap Amount</span>.** See <https://example.com> and [terms](commonpaper.com/x).',
      ),
    ).toEqual([
      { text: "Liability is capped at the ", bold: true },
      { text: "General Cap Amount", bold: true, term: true },
      { text: ".", bold: true },
      { text: " See " },
      { text: "https://example.com", href: "https://example.com" },
      { text: " and " },
      { text: "terms", href: "https://commonpaper.com/x" },
      { text: "." },
    ]);
  });

  it("drops anchor spans but keeps their text", () => {
    expect(
      parseRuns(
        '<span id="4.1">**"Available Minutes"**</span> means <span id="2.1.a"></span>all <span class="orderform_link" id="3.2.a">Uptime Credit</span>',
      ),
    ).toEqual([
      { text: '"Available Minutes"', bold: true },
      { text: " means all " },
      { text: "Uptime Credit", term: true },
    ]);
  });

  it.each([
    ["an unknown tag", "a <div>b</div>"],
    ["an unclosed span", '<span class="coverpage_link">Customer'],
    ["a stray closing span", "a</span>"],
    ["unbalanced bold", "**bold"],
  ])("throws on %s", (_case, source) => {
    expect(() => parseRuns(source)).toThrow();
  });
});

describe("parseTerms", () => {
  const sample = [
    "# Sample Agreement",
    "",
    '1. <span class="header_2" id="1">Service</span>',
    '    1. <span class="header_3" id="1.1">Access.</span>  <span class="coverpage_link">Provider</span> grants access',
    "    that continues on a wrapped line.  ",
    "        a. first lettered item;",
    "            i. a roman item; and",
    "        b. second lettered item.",
    "    2. A clause without a heading.",
    "",
    "2. Definitions",
    '    1. <span id="2.1">**"Term"**</span> means‎ something.',
  ].join("\n");

  it("builds a numbered tree with headings, bodies and children", () => {
    const doc = parseTerms(sample);
    expect(doc.title).toBe("Sample Agreement");
    const [service, definitions] = doc.sections;
    expect(service).toMatchObject({ label: "1.", heading: "Service", runs: [] });

    const [access, plain] = service.children;
    expect(access.label).toBe("1.1");
    expect(access.heading).toBe("Access.");
    expect(access.runs).toEqual([
      { text: "Provider", term: true },
      { text: " grants access that continues on a wrapped line." },
    ]);
    expect(access.children.map((node) => node.label)).toEqual(["(a)", "(b)"]);
    expect(access.children[0].children[0]).toMatchObject({ label: "(i)" });
    expect(plain.label).toBe("1.2");
    expect(plain.heading).toBeUndefined();
    expect(runsText(plain.runs)).toBe("A clause without a heading.");

    // A top-level item without a heading span, and an invisible mark removed.
    expect(definitions.heading).toBe("Definitions");
    expect(runsText(definitions.children[0].runs)).toBe('"Term" means something.');
    expect(doc.footer).toEqual([]);
  });

  it("keeps a trailing paragraph as the footer", () => {
    const doc = parseTerms(`${sample}\n\nCommon Paper [Version 1](https://example.com).`);
    expect(runsText(doc.footer)).toBe("Common Paper Version 1.");
  });

  it.each([
    ["text before the first item", "# T\n\nIntro text\n\n1. Item"],
    ["an odd indent", "# T\n\n1. Item\n  1. Two spaces"],
    ["an item nested too deep", "# T\n\n1. Item\n        a. Skipped a level"],
    ["an item after the footer", "# T\n\n1. Item\n\nFooter\n\n2. Item"],
    ["no sections", "# T"],
  ])("throws on %s", (_case, markdown) => {
    expect(() => parseTerms(markdown)).toThrow();
  });
});

describe("the real templates", async () => {
  const specs = (await readDocumentSpecs()).filter(
    (spec): spec is GenericSpec => spec.kind === "generic",
  );

  const plainTemplate = (markdown: string) =>
    markdown
      .replace(/^# .*$/m, "")
      .replace(/^ *(\d+|[a-z]+)\. /gm, "")
      .replace(/<(https?:\/\/[^>]+)>/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>|\*\*|[​-‏]/g, "")
      .replace(/\s+/g, "");

  const plainTree = (nodes: TermNode[]): string =>
    nodes
      .map((node) => (node.heading ?? "") + runsText(node.runs) + plainTree(node.children))
      .join("");

  it.each(specs.map((spec) => [spec.template, spec] as const))(
    "%s parses without losing text",
    async (template, spec) => {
      const markdown = await readTemplate(template);
      const doc = parseTerms(markdown);

      expect(doc.title).toBe(spec.name);
      expect(doc.sections.length).toBeGreaterThan(2);
      doc.sections.forEach((section, i) => {
        expect(section.label).toBe(`${i + 1}.`);
        expect(section.heading).toBeTruthy();
      });
      expect(plainTree(doc.sections).replace(/\s+/g, "")).toBe(plainTemplate(markdown));
    },
  );
});
