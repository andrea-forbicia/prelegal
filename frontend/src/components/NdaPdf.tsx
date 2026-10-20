import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  COVER_PAGE_INTRO,
  COVER_PAGE_SIGNING_STATEMENT,
  COVER_PAGE_TITLE,
  type CoverPage,
  type Value,
} from "@/lib/cover-page";
import type { Inline, StandardTerms } from "@/lib/standard-terms";
import { SANS, SERIF } from "./pdf-fonts";

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 64,
    fontFamily: SERIF,
    // Noto's fi/ff ligatures don't map back to text, so copying or searching
    // the PDF would find "Confdential" instead of "Confidential".
    fontFeatureSettings: { liga: false },
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  title: {
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 14,
  },
  paragraph: { marginBottom: 10 },
  section: { marginBottom: 7 },
  heading: { fontFamily: SANS, fontWeight: "bold", fontSize: 10.5 },
  hint: { fontFamily: SANS, fontWeight: "normal", fontSize: 8, color: "#64748b", marginBottom: 2 },
  bold: { fontWeight: "bold" },
  link: { color: "#1d4ed8" },
  placeholder: { color: "#b45309" },
  table: { marginTop: 8, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#94a3b8" },
  row: { flexDirection: "row" },
  cell: {
    flex: 1,
    minHeight: 22,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#94a3b8",
    fontFamily: SANS,
    fontSize: 9,
  },
  labelCell: { flex: 0.8, fontWeight: "bold" },
  headerCell: { fontWeight: "bold", textAlign: "center" },
  footer: { marginTop: 8, fontSize: 9, color: "#475569" },
});

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    switch (part.kind) {
      case "bold":
        return <Text key={i} style={styles.bold}>{part.text}</Text>;
      case "term":
        return <Text key={i} style={{ textDecoration: "underline" }}>{part.text}</Text>;
      case "link":
        return <Link key={i} src={part.href} style={styles.link}>{part.text}</Link>;
      default:
        return part.text;
    }
  });
}

function ValueText({ value }: { value: Value }) {
  return <Text style={value.filled ? undefined : styles.placeholder}>{value.text}</Text>;
}

export function NdaPdf({
  coverPage,
  standardTerms,
}: {
  coverPage: CoverPage;
  standardTerms: StandardTerms;
}) {
  return (
    <Document title={COVER_PAGE_TITLE} creator="Prelegal" producer="Prelegal">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{COVER_PAGE_TITLE}</Text>
        <Text style={styles.paragraph}>
          <InlineText parts={COVER_PAGE_INTRO} />
        </Text>

        {coverPage.sections.map((section) => (
          <View key={section.heading} style={styles.section} wrap={false}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.hint && <Text style={styles.hint}>{section.hint}</Text>}
            {section.lines.map((line, i) => (
              <Text key={i}>
                {line.label && `${line.label}: `}
                <ValueText value={line.value} />
              </Text>
            ))}
          </View>
        ))}

        {/* Keep the signing statement on the same page as the signature table. */}
        <View wrap={false}>
          <Text style={styles.paragraph}>{COVER_PAGE_SIGNING_STATEMENT}</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              <Text style={[styles.cell, styles.headerCell]}>PARTY 1</Text>
              <Text style={[styles.cell, styles.headerCell]}>PARTY 2</Text>
            </View>
            {coverPage.signatureRows.map((row) => (
              <View key={row.label} style={styles.row}>
                <View style={[styles.cell, styles.labelCell]}>
                  <Text>{row.label}</Text>
                  {row.hint && <Text style={styles.hint}>{row.hint}</Text>}
                </View>
                {row.values.map((value, i) => (
                  <View key={i} style={styles.cell}>
                    {value && <ValueText value={value} />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{standardTerms.title}</Text>
        {standardTerms.clauses.map((clause) => (
          <Text key={clause.number} style={styles.paragraph}>
            {clause.number}. <Text style={styles.bold}>{clause.title}</Text>.{" "}
            <InlineText parts={clause.body} />
          </Text>
        ))}
        <Text style={styles.footer}>
          <InlineText parts={standardTerms.footer} />
        </Text>
      </Page>
    </Document>
  );
}
