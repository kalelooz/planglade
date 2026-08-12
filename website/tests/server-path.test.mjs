import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeRequestPath } from '../scripts/request-path.mjs'

test('decodes a valid request path without its query', () => {
  assert.equal(decodeRequestPath('/product/?from=home'), '/product/')
})

test('rejects malformed percent encoding', () => {
  assert.equal(decodeRequestPath('/%'), null)
})
