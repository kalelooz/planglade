"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import BoardPage from "../../board/page";
import MyTasksPage from "../../my-tasks/page";
import WorkItemsPage from "../../work-items/page";

function TasksRouteContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  if (view === "board") {
    return <BoardPage />;
  }

  if (view === "list") {
    return <WorkItemsPage />;
  }

  return <MyTasksPage />;
}

export default function TasksRoute() {
  return (
    <Suspense fallback={null}>
      <TasksRouteContent />
    </Suspense>
  );
}
