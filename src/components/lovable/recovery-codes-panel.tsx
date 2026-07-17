"use client"

import * as React from "react"
import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

type RecoveryCodesPanelProps = {
  codes: string[]
  title: string
  description: string
  continueLabel: string
  onContinue: () => void | Promise<void>
}

export function RecoveryCodesPanel({
  codes,
  title,
  description,
  continueLabel,
  onContinue,
}: RecoveryCodesPanelProps) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const [saved, setSaved] = React.useState(false)
  const [copyStatus, setCopyStatus] = React.useState("")

  React.useEffect(() => {
    setSaved(false)
    setCopyStatus("")
    headingRef.current?.focus()
  }, [codes])

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(`PlanGlade recovery codes\n${codes.join("\n")}`)
      setCopyStatus("Recovery codes copied.")
    } catch {
      setCopyStatus("Copy failed. Select and save the codes manually.")
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="recovery-codes-title">
      <h2
        ref={headingRef}
        id="recovery-codes-title"
        tabIndex={-1}
        className="text-lg font-semibold tracking-tight outline-none"
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

      <ol className="mt-5 grid gap-2 font-mono text-xs" aria-label="Recovery codes">
        {codes.map((code, index) => {
          const groups = code.split("-")
          return (
            <li key={code} className="select-text rounded-md border border-border bg-muted/50 px-3 py-2.5">
              <span className="mr-3 text-muted-foreground">{index + 1}.</span>
              {groups.map((group, groupIndex) => (
                <span key={`${code}-${groupIndex}`} className="inline-block whitespace-nowrap">
                  {group}{groupIndex < groups.length - 1 ? "-" : ""}
                </span>
              ))}
            </li>
          )
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyCodes()}>
          <Copy className="size-4" aria-hidden="true" />
          Copy all codes
        </Button>
        <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">{copyStatus}</p>
      </div>

      <label className="mt-5 flex min-h-11 items-start gap-3 rounded-md border border-border p-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mt-0.5 size-5"
        />
        I saved these recovery codes. PlanGlade cannot show them again.
      </label>
      <Button
        type="button"
        className="mt-4 min-h-11"
        disabled={!saved}
        onClick={() => void onContinue()}
      >
        {continueLabel}
      </Button>
    </section>
  )
}
