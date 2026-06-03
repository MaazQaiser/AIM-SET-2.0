import { ProjectRepoDetailClient } from "@/components/knowledge/project-repo-detail-client";

export default async function KnowledgeProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectRepoDetailClient projectId={projectId} />;
}
