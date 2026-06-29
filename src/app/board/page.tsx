"use client";

import { Suspense } from "react";
import { BoardPageContent } from "./board-page-content";

export default function Board() {
  return (
    <Suspense fallback={null}>
      <BoardPageContent />
    </Suspense>
  );
}
