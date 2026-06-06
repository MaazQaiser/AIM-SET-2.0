import { redirect } from "next/navigation";

export default function KnowledgeRedirectPage() {
  redirect("/content?tab=library");
}
