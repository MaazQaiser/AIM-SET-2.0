import { redirect } from "next/navigation";

export default function KnowledgeProjectsRedirect() {
  redirect("/content?tab=projects");
}
