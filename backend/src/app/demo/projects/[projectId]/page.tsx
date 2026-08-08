import { DemoClient } from "../../demo-client"
import { demoProjects } from "@/lib/demo-data"

export function generateStaticParams() {
  return demoProjects.map((project) => ({ projectId: project.id }))
}

export default async function DemoProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <DemoClient slug={["projects", projectId]} />
}
