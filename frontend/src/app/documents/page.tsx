import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { DocumentList } from "@/components/DocumentList";

export const metadata: Metadata = { title: "My documents | Prelegal" };

export default function DocumentsPage() {
  return (
    <AppShell>
      <DocumentList />
    </AppShell>
  );
}
