import { normalizeEmail } from "@/lib/local-auth-email"

type SetupContractError = {
  status: 400 | 413 | 415
  code: "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"
  message: string
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: SetupContractError }

const invalidRequest = (): SetupContractError => ({
  status: 400,
  code: "INVALID_REQUEST",
  message: "The setup request is invalid.",
})

const payloadTooLarge = (): SetupContractError => ({
  status: 413,
  code: "PAYLOAD_TOO_LARGE",
  message: "The setup request is too large.",
})

const unsupportedMediaType = (): SetupContractError => ({
  status: 415,
  code: "UNSUPPORTED_MEDIA_TYPE",
  message: "The setup request must use JSON.",
})

async function readJsonObject(
  request: Request,
  maximumBytes: number,
): Promise<ParseResult<Record<string, unknown>>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) {
    return { ok: false, error: unsupportedMediaType() }
  }

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null && Number(declaredLength) > maximumBytes) {
    return { ok: false, error: payloadTooLarge() }
  }

  const reader = request.body?.getReader()
  if (!reader) return { ok: false, error: invalidRequest() }

  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maximumBytes) {
      await reader.cancel()
      return { ok: false, error: payloadTooLarge() }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      return { ok: false, error: invalidRequest() }
    }
    return { ok: true, data: value as Record<string, unknown> }
  } catch {
    return { ok: false, error: invalidRequest() }
  }
}

export async function parseSetupClaimRequest(
  request: Request,
): Promise<ParseResult<{ setupToken: unknown }>> {
  const parsed = await readJsonObject(request, 1024)
  if (!parsed.ok) return parsed
  if (Object.keys(parsed.data).some((key) => key !== "setupToken")) {
    return { ok: false, error: invalidRequest() }
  }
  return { ok: true, data: { setupToken: parsed.data.setupToken } }
}

export async function parseSetupCompletionRequest(request: Request): Promise<
  ParseResult<{ email: string; name: string; password: string; workspaceName: string }>
> {
  const parsed = await readJsonObject(request, 4096)
  if (!parsed.ok) return parsed

  const allowed = new Set(["email", "name", "password", "workspaceName"])
  if (
    Object.keys(parsed.data).some((key) => !allowed.has(key)) ||
    typeof parsed.data.email !== "string" ||
    typeof parsed.data.name !== "string" ||
    typeof parsed.data.password !== "string" ||
    typeof parsed.data.workspaceName !== "string"
  ) {
    return { ok: false, error: invalidRequest() }
  }

  const email = normalizeEmail(parsed.data.email)
  const name = parsed.data.name.trim()
  const workspaceName = parsed.data.workspaceName.trim()
  const passwordLength = [...parsed.data.password].length
  if (
    parsed.data.email.length > 320 ||
    !email ||
    name.length < 1 ||
    name.length > 120 ||
    passwordLength < 15 ||
    passwordLength > 128 ||
    workspaceName.length < 2 ||
    workspaceName.length > 80
  ) {
    return { ok: false, error: invalidRequest() }
  }

  return { ok: true, data: { email, name, password: parsed.data.password, workspaceName } }
}
