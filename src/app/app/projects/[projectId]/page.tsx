import { ProjectsPageContent } from "../projects-page-content";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectsPageContent projectId={projectId} />;
}
