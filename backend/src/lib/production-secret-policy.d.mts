export function getSecretConfigError(
  name: string,
  value: string | undefined,
  options?: { minBytes?: number }
): string | null
export function getOptionalSecretConfigError(
  name: string,
  value: string | undefined,
  options?: { minBytes?: number }
): string | null
