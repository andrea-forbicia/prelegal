import { NdaCreator } from "@/components/NdaCreator";
import { parseStandardTerms } from "@/lib/standard-terms";
import { readStandardTermsMarkdown } from "@/lib/templates";

export default async function Home() {
  // Read at build time from the shared templates/ directory.
  const standardTerms = parseStandardTerms(await readStandardTermsMarkdown());
  return <NdaCreator standardTerms={standardTerms} />;
}
