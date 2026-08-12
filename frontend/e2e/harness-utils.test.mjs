import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { parsePort, waitForChildExit } from './harness-utils.mjs'

describe('E2E harness port parsing', () => {
  it('accepts defaults and valid configured ports', () => {
    expect(parsePort(undefined, 'TEST_PORT', 5173)).toBe(5173)
    expect(parsePort('3203', 'TEST_PORT', 5173)).toBe(3203)
  })

  it.each(['', 'abc', '12.5', '0', '65536'])('rejects invalid port %j', (value) => {
    expect(() => parsePort(value, 'TEST_PORT', 5173)).toThrow('TEST_PORT must be an integer between 1 and 65535')
  })

  it('waits until a child emits exit', async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: null })
    const exited = waitForChildExit(child, 100)

    setTimeout(() => {
      child.exitCode = 0
      child.emit('exit', 0, null)
    }, 5)

    await expect(exited).resolves.toBe(true)
  })
})
