import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

const PAGE_WIDTH_CLASSES = {
  standard: "max-w-[1080px]",
  wide: "max-w-[1320px]",
  reading: "max-w-[900px]",
  canvas: "max-w-none",
} as const;

export type PageWidthMode = keyof typeof PAGE_WIDTH_CLASSES;

type PageWidthProps = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "main";
  mode: PageWidthMode;
};

export function PageWidth({ as: Element = "div", className, mode, ...props }: PageWidthProps) {
  return (
    <Element
      {...props}
      data-page-width={mode}
      className={cn("mx-auto w-full", PAGE_WIDTH_CLASSES[mode], className)}
    />
  );
}
