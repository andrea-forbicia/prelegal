import { describe, expect, it } from "vitest";
import { parseInline, parseStandardTerms } from "./standard-terms";
import { readStandardTermsMarkdown } from "./templates";

describe("parseInline", () => {
  it("splits text, bold, defined terms and links", () => {
    expect(
      parseInline(
        'Use for the <span class="coverpage_link">Purpose</span> (“**MNDA**”), see [site](https://example.com).',
      ),
    ).toEqual([
      { kind: "text", text: "Use for the " },
      { kind: "term", text: "Purpose" },
      { kind: "text", text: " (“" },
      { kind: "bold", text: "MNDA" },
      { kind: "text", text: "”), see " },
      { kind: "link", text: "site", href: "https://example.com" },
      { kind: "text", text: "." },
    ]);
  });

  it("returns plain text unchanged", () => {
    expect(parseInline("Hello")).toEqual([{ kind: "text", text: "Hello" }]);
  });
});

describe("parseStandardTerms", () => {
  it("parses the Common Paper Mutual NDA template", async () => {
    const terms = parseStandardTerms(await readStandardTermsMarkdown());

    expect(terms.title).toBe("Standard Terms");
    expect(terms.clauses.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(terms.clauses[0].title).toBe("Introduction");
    expect(terms.clauses[8].title).toBe("Governing Law and Jurisdiction");

    const termsUsed = new Set(
      terms.clauses.flatMap((c) => c.body.filter((i) => i.kind === "term").map((i) => i.text)),
    );
    expect(termsUsed).toEqual(
      new Set([
        "Purpose",
        "Effective Date",
        "MNDA Term",
        "Term of Confidentiality",
        "Governing Law",
        "Jurisdiction",
      ]),
    );

    // No raw markup should survive parsing.
    const allText = terms.clauses.flatMap((c) => c.body.map((i) => i.text)).join("");
    expect(allText).not.toMatch(/<span|\*\*/);

    expect(terms.footer).toContainEqual({
      kind: "link",
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("handles CRLF line endings", () => {
    const terms = parseStandardTerms("# Terms\r\n\r\n1. **One**. First.\r\n\r\nFooter");
    expect(terms.clauses).toEqual([
      { number: 1, title: "One", body: [{ kind: "text", text: "First." }] },
    ]);
    expect(terms.footer).toEqual([{ kind: "text", text: "Footer" }]);
  });

  it("joins a clause wrapped over several lines", () => {
    const terms = parseStandardTerms("# Terms\n\n1. **One**. First line\nsecond line.\n\nFooter");
    expect(terms.clauses[0].body).toEqual([{ kind: "text", text: "First line second line." }]);
  });

  it("rejects paragraphs it does not recognize instead of dropping them", () => {
    expect(() =>
      parseStandardTerms("# Terms\n\n1. **One.** Bold includes the period.\n\nFooter"),
    ).toThrow(/Unrecognized paragraph/);
    expect(() =>
      parseStandardTerms("# Terms\n\n1. **One**. First.\n\nStray text\n\n2. **Two**. Second."),
    ).toThrow(/Unrecognized paragraph/);
    expect(() => parseStandardTerms("# Terms\n\nJust text")).toThrow();
  });
});
