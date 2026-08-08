export function readPlanGladeEnv(name: string) {
  return process.env[`PLANGLADE_${name}`] ?? process.env[`FLOWBOARD_${name}`]
}

export function readPublicPlanGladeEnv(name: string) {
  return process.env[`NEXT_PUBLIC_PLANGLADE_${name}`] ?? process.env[`NEXT_PUBLIC_FLOWBOARD_${name}`]
}
