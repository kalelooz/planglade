import assert from "node:assert/strict"
import test from "node:test"

import { hasSelfHostRoot, selfHostRootDestination } from "../src/lib/self-host-root-route"

test("self-host root sends setup states to setup and complete installs through authentication", () => {
  assert.equal(selfHostRootDestination("eligible", false), "/setup")
  assert.equal(selfHostRootDestination("actively_claimed", false), "/setup")
  assert.equal(selfHostRootDestination("blocked", false), "/setup")
  assert.equal(selfHostRootDestination("complete", false), "/login")
  assert.equal(selfHostRootDestination("complete", true), "/app")
})

test("only trusted self-host configuration replaces the public root", () => {
  assert.equal(hasSelfHostRoot(undefined, undefined), false)
  assert.equal(hasSelfHostRoot("false", undefined), false)
  assert.equal(hasSelfHostRoot("true", undefined), true)
  assert.equal(hasSelfHostRoot(undefined, "setup-token"), true)
})
