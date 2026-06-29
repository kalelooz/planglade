type EmailProvider = "resend" | "console" | "disabled"

export type SendEmailInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
  idempotencyKey?: string
}

export type SendEmailResult =
  | {
      ok: true
      provider: EmailProvider
      messageId: string
    }
  | {
      ok: false
      provider: EmailProvider
      error: string
      status?: number
    }

function resolveEmailProvider(): EmailProvider {
  const configured = (process.env.FLOWBOARD_EMAIL_PROVIDER ?? "").trim().toLowerCase()
  if (configured === "resend") return "resend"
  if (configured === "console") return "console"
  if (configured === "disabled") return "disabled"
  return process.env.NODE_ENV === "production" ? "disabled" : "console"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function textToHtml(text: string) {
  const escaped = escapeHtml(text)
  return escaped.replace(/\r?\n/g, "<br />")
}

function resolveFromAddress() {
  const from = process.env.FLOWBOARD_EMAIL_FROM?.trim()
  return from && from.length > 0 ? from : ""
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = resolveEmailProvider()
  const to = Array.isArray(input.to) ? input.to : [input.to]
  const normalizedTo = to.map((value) => value.trim()).filter(Boolean)

  if (normalizedTo.length === 0) {
    return { ok: false, provider, error: "Recipient email is required" }
  }

  if (provider === "disabled") {
    return {
      ok: false,
      provider,
      error:
        "Email delivery is disabled. Configure FLOWBOARD_EMAIL_PROVIDER and provider credentials.",
    }
  }

  const from = resolveFromAddress()

  if (provider === "console") {
    const consoleFrom = from || "PlanGlade <onboarding@planglade.local>"
    console.info("[email-delivery:console]", {
      from: consoleFrom,
      to: normalizedTo,
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text),
      replyTo: input.replyTo ?? null,
    })
    return {
      ok: true,
      provider,
      messageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }
  }

  if (!from) {
    return {
      ok: false,
      provider,
      error:
        "FLOWBOARD_EMAIL_FROM is missing. Configure a verified sender address for invite emails.",
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: false,
      provider,
      error: "RESEND_API_KEY is missing for FLOWBOARD_EMAIL_PROVIDER=resend.",
    }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: normalizedTo,
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
    error?: { message?: string } | string
  }

  if (!response.ok) {
    const error =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message ?? payload.message ?? "Failed to send email"
    return {
      ok: false,
      provider,
      status: response.status,
      error,
    }
  }

  return {
    ok: true,
    provider,
    messageId: payload.id ?? `resend-${Date.now()}`,
  }
}
