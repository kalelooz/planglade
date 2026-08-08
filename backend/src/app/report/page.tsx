"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ReportRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const projectId = searchParams.get("project");
    const target = projectId ? `/projects?project=${encodeURIComponent(projectId)}` : "/projects";
    router.replace(target);
  }, [router, searchParams]);

  return null;
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportRedirect />
    </Suspense>
  );
}
