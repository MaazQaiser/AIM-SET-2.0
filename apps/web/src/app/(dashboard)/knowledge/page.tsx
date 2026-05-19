import type { Metadata } from "next";
import { KnowledgePageClient } from "@/components/knowledge/knowledge-page-client";

export const metadata: Metadata = { title: "Knowledge base" };

export default function KnowledgePage() {
  return <KnowledgePageClient />;
}
