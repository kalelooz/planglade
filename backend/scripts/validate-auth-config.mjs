import { evaluateProductionConfiguration } from "../src/lib/production-config.mjs"

const configuration = evaluateProductionConfiguration(process.env, {
  productionLike: process.env.NODE_ENV === "production" || process.env.CI === "true",
})

if (configuration.errors.length > 0) {
  for (const error of configuration.errors) {
    console.error(`[auth-config] ${error}`)
  }
  process.exit(1)
}
