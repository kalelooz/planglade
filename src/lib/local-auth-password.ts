import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 3
const MAXMEM = 128 * 1024 * 1024
const SALT_BYTES = 16
const KEY_BYTES = 32
const MAX_PASSWORD_LENGTH = 1024
const DUMMY_PASSWORD_HASH =
  "scrypt$v1$32768$8$3$XO4oOHlL6GZ3Qg4gdvecAw$Fi5AFcE5DEs-bx5iuPT7V7NdiDAltOgidX18sF_Pl5Q"

type ParsedHash = { salt: Buffer; derivedKey: Buffer }

function parsePasswordHash(encoded: string): ParsedHash | null {
  const parts = encoded.split("$")
  if (
    parts.length !== 7 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "v1" ||
    parts[2] !== String(SCRYPT_N) ||
    parts[3] !== String(SCRYPT_R) ||
    parts[4] !== String(SCRYPT_P)
  ) {
    return null
  }

  try {
    const salt = Buffer.from(parts[5], "base64url")
    const derivedKey = Buffer.from(parts[6], "base64url")
    if (salt.length < SALT_BYTES || derivedKey.length !== KEY_BYTES) return null
    return { salt, derivedKey }
  } catch {
    return null
  }
}

async function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM },
      (error, derivedKey) => (error ? reject(error) : resolve(Buffer.from(derivedKey)))
    )
  })
}

function assertPasswordLength(password: string) {
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error("Password is too long")
}

export function isPasswordHash(value: unknown): value is string {
  return typeof value === "string" && parsePasswordHash(value) !== null
}

export async function hashPassword(password: string) {
  assertPasswordLength(password)
  const salt = randomBytes(SALT_BYTES)
  const derivedKey = await deriveKey(password, salt)
  return `scrypt$v1$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`
}

export async function verifyPassword(password: string, encodedHash: string) {
  if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) return false
  const parsed = parsePasswordHash(encodedHash)
  if (!parsed) return false
  const candidate = await deriveKey(password, parsed.salt)
  return timingSafeEqual(candidate, parsed.derivedKey)
}

export function getDummyPasswordHash() {
  return DUMMY_PASSWORD_HASH
}
