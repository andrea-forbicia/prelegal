import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { DocumentCreator } from "@/components/DocumentCreator";
import { Loading } from "@/components/ui";
import { loadCatalog } from "@/lib/templates";

export default async function Home() {
  // Read at build time from documents.json and the shared templates/ directory.
  const catalog = await loadCatalog();
  return (
    <AppShell>
      {/* The editor reads ?id= with useSearchParams, which a static export needs inside Suspense. */}
      <Suspense fallback={<Loading />}>
        <DocumentCreator catalog={catalog} />
      </Suspense>
    </AppShell>
  );
}
