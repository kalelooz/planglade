"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group relative inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 lg:h-[1.15rem] lg:w-8 lg:rounded-full",
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-track"
        aria-hidden="true"
        className="absolute h-[1.15rem] w-8 rounded-full border border-transparent bg-input shadow-xs transition-[background-color,box-shadow] group-data-[state=checked]:bg-primary dark:bg-input/80"
      />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute left-[7px] size-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[14px] data-[state=unchecked]:translate-x-0 dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
