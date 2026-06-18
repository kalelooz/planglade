"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:rounded-lg group-[.toaster]:border-zinc-200/80 group-[.toaster]:bg-white group-[.toaster]:px-3.5 group-[.toaster]:py-3 group-[.toaster]:text-zinc-900 group-[.toaster]:shadow-md group-[.toaster]:animate-slide-up group-[.toaster]:before:mr-1 group-[.toaster]:before:size-1.5 group-[.toaster]:before:rounded-full group-[.toaster]:before:bg-zinc-950",
          title: "group-[.toast]:text-xs group-[.toast]:font-medium",
          description: "group-[.toast]:text-[11px] group-[.toast]:text-zinc-500",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
