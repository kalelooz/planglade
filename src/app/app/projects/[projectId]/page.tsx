import { redirect } from "next/navigation";

type ProjectDetailRouteProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function appendSearchParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    value.forEach((entry) => params.append(key, entry));
    return;
  }

  if (value !== undefined) {
    params.set(key, value);
  }
}

export default async function ProjectDetailRoute({ params, searchParams }: ProjectDetailRouteProps) {
  const { projectId } = await params;
  const incoming = searchParams ? await searchParams : {};
  const nextParams = new URLSearchParams();

  Object.entries(incoming).forEach(([key, value]) => {
    if (key !== "project") {
      appendSearchParam(nextParams, key, value);
    }
  });
  nextParams.set("project", projectId);

  redirect(`/app/projects?${nextParams.toString()}`);
}
