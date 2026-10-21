import { DocumentCreator } from "@/components/DocumentCreator";
import { loadCatalog } from "@/lib/templates";

export default async function Home() {
  // Read at build time from documents.json and the shared templates/ directory.
  return <DocumentCreator catalog={await loadCatalog()} />;
}
