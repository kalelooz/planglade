import { evaluateProductionConfiguration } from "../src/lib/production-config.mjs"

const configuration = evaluateProductionConfiguration(process.env, {
  productionLike: process.env.NODE_ENV === "production" || process.env.CI === "true",
})

if (configuration.errors[0]) {
  console.error(`[auth-config] ${configuration.errors[0]}`)
  process.exit(1)
}
