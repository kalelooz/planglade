import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeRequestPath, resolveRequest } from '../scripts/request-path.mjs'

test('decodes a valid request path without its query', () => {
  assert.equal(decodeRequestPath('/product/?from=home'), '/product/')
})

test('rejects malformed percent encoding', () => {
  assert.equal(decodeRequestPath('/%'), null)
})

test('resolves requests only through the preloaded file index', () => {
  const files = new Map([
    ['/index.html', { name: 'home' }],
    ['/demo/index.html', { name: 'demo' }],
    ['/404.html', { name: 'missing' }],
  ])

  assert.deepEqual(resolveRequest(files, '/'), {
    asset: { name: 'home' },
    malformed: false,
    status: 200,
  })
  assert.deepEqual(resolveRequest(files, '/demo/tasks'), {
    asset: { name: 'demo' },
    malformed: false,
    status: 200,
  })
  assert.deepEqual(resolveRequest(files, '/../package.json'), {
    asset: { name: 'missing' },
    malformed: false,
    status: 404,
  })
})
