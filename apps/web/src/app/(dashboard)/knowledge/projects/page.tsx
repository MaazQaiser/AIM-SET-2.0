import type { Metadata } from "next";
import { ProjectRepoList } from "@/components/knowledge/project-repo-list";

export const metadata: Metadata = { title: "Project repo" };

export default function KnowledgeProjectsPage() {
  return <ProjectRepoList />;
}
