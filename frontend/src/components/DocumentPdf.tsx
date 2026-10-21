import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Value } from "@/lib/cover-page";
import type { GenericCoverPage } from "@/lib/generic-cover-page";
import type { Run, TermNode, TermsDoc } from "@/lib/terms-parser";
import { DISCLAIMER } from "@/lib/disclaimer";
import { SANS, SERIF } from "./pdf-fonts";

// Mirrors the styles of NdaPdf so every document looks the same.
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    // Room for the disclaimer at the foot of every page.
    paddingBottom: 64,
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
  clauseHeading: { fontFamily: SANS, fontWeight: "bold", fontSize: 11, marginTop: 6, marginBottom: 4 },
  clause: { marginBottom: 6 },
  label: { fontFamily: SANS, fontSize: 9.5 },
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
  disclaimer: {
    position: "absolute",
    bottom: 24,
    left: 64,
    right: 64,
    fontFamily: SANS,
    fontSize: 7.5,
    color: "#64748b",
    textAlign: "center",
  },
});

function RunText({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    const style = {
      ...(run.bold ? styles.bold : {}),
      ...(run.term ? { textDecoration: "underline" as const } : {}),
    };
    return run.href ? (
      <Link key={i} src={run.href} style={[styles.link, style]}>
        {run.text}
      </Link>
    ) : (
      <Text key={i} style={style}>
        {run.text}
      </Text>
    );
  });
}

function ValueText({ value }: { value: Value }) {
  return <Text style={value.filled ? undefined : styles.placeholder}>{value.text}</Text>;
}

function Clauses({ nodes, depth }: { nodes: TermNode[]; depth: number }) {
  return nodes.map((node) =>
    depth === 0 ? (
      <View key={node.label}>
        {/* Keep a section heading with the start of its first clause. */}
        <Text style={styles.clauseHeading} minPresenceAhead={40}>
          {node.label} {node.heading}
        </Text>
        {node.runs.length > 0 && (
          <Text style={styles.clause}>
            <RunText runs={node.runs} />
          </Text>
        )}
        <Clauses nodes={node.children} depth={1} />
      </View>
    ) : (
      <View key={node.label} style={{ marginLeft: (depth - 1) * 14 }}>
        <Text style={styles.clause}>
          {node.label} {node.heading && <Text style={styles.bold}>{node.heading} </Text>}
          <RunText runs={node.runs} />
        </Text>
        <Clauses nodes={node.children} depth={depth + 1} />
      </View>
    ),
  );
}

/** The PDF of a generic document: the Cover Page, then its Standard Terms. */
export function DocumentPdf({
  coverPage,
  terms,
  footer,
}: {
  coverPage: GenericCoverPage;
  terms: TermsDoc;
  footer: Run[];
}) {
  return (
    <Document title={coverPage.title} creator="Prelegal" producer="Prelegal">
      <Page size="LETTER" style={styles.page}>
        <Text fixed style={styles.disclaimer}>
          {DISCLAIMER}
        </Text>
        <Text style={styles.title}>{coverPage.title}</Text>
        <Text style={styles.paragraph}>
          <RunText runs={coverPage.intro} />
        </Text>

        {coverPage.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} minPresenceAhead={30}>
              {section.heading}
            </Text>
            {section.lines.map((line, i) => (
              <Text key={i} style={{ marginBottom: 2 }} wrap={false}>
                {line.label && <Text style={styles.label}>{`${line.label}: `}</Text>}
                <ValueText value={line.value} />
              </Text>
            ))}
          </View>
        ))}

        {/* Keep the signing statement on the same page as the signature table. */}
        <View wrap={false}>
          <Text style={styles.paragraph}>{coverPage.signingStatement}</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              {coverPage.partyLabels.map((label) => (
                <Text key={label} style={[styles.cell, styles.headerCell]}>
                  {label}
                </Text>
              ))}
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
        <Text fixed style={styles.disclaimer}>
          {DISCLAIMER}
        </Text>
        <Text style={styles.title}>{terms.title} Standard Terms</Text>
        <Clauses nodes={terms.sections} depth={0} />
        <Text style={styles.footer}>
          <RunText runs={footer} />
        </Text>
      </Page>
    </Document>
  );
}
