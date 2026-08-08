export function readPlanGladeEnv(name: string) {
  return process.env[`PLANGLADE_${name}`]
}

export function readPublicPlanGladeEnv(name: string) {
  return process.env[`NEXT_PUBLIC_PLANGLADE_${name}`]
}
