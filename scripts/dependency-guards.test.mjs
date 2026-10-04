import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))

// A regressed parser can hang synchronously; keep hostile inputs in a bounded child.
function probe(source, modulePath) {
  execFileSync(process.execPath, ['--input-type=commonjs', '-e', source, modulePath], {
    timeout: 5000, windowsHide: true, stdio: 'pipe',
  })
}

for (const workspace of ['backend', 'frontend']) {
  test(`${workspace} glob consumers retain compatibility and reject excessive nesting`, () => {
    const lock = JSON.parse(readFileSync(path.join(root, workspace, 'package-lock.json'), 'utf8'))
    const copies = Object.entries(lock.packages).filter(([name]) => name.endsWith('node_modules/braces'))
    assert.ok(copies.length > 0)
    for (const [location, metadata] of copies) {
      assert.equal(metadata.name, '@dieub/braces-depth-guard')
      assert.equal(metadata.version, '3.0.3-pn.3')
      assert.equal(metadata.resolved, 'https://registry.npmjs.org/@dieub/braces-depth-guard/-/braces-depth-guard-3.0.3-pn.3.tgz')
      assert.equal(metadata.integrity, 'sha512-QY+Uq4s42STyIMPoRkBuUZfYyvz0uZuwuUburLwMx5N+lWqnHHaBxcKPtgKVKjTyFnS1q4ivKu9Wxi4VG7FE9Q==')
      const installed = JSON.parse(readFileSync(path.join(root, workspace, location, 'package.json'), 'utf8'))
      assert.equal(installed.name, metadata.name)
      assert.equal(installed.version, metadata.version)
      probe(`
        const assert = require('node:assert/strict');
        const braces = require(process.argv[1]);
        assert.deepEqual(braces.expand('src/{pages,components}/**/*.{ts,tsx}'), [
          'src/pages/**/*.ts', 'src/pages/**/*.tsx',
          'src/components/**/*.ts', 'src/components/**/*.tsx',
        ]);
        assert.deepEqual(braces.expand('item-{1..3}'), ['item-1', 'item-2', 'item-3']);
        for (const pair of [['{','}'], ['(',')']]) {
          const pattern = pair[0].repeat(4000) + 'a' + pair[1].repeat(4000);
          for (const method of ['parse', 'compile', 'expand', 'stringify']) {
            assert.throws(() => braces[method](pattern), {name: 'SyntaxError', message: /depth/});
          }
        }
        const deep = {type: 'root', nodes: []};
        let cursor = deep;
        for (let i = 0; i < 200; i++) {
          const child = {type: 'paren', nodes: [], parent: cursor};
          cursor.nodes.push(child); cursor = child;
        }
        for (const method of ['compile', 'expand', 'stringify']) {
          assert.throws(() => braces[method](deep), {name: 'RangeError', message: /depth/});
        }
      `, path.join(root, workspace, location))
    }
  })
}

test('multipart parser rejects oversized boundaries and handles prototype-named headers', () => {
  probe(`
    const assert = require('node:assert/strict');
    const Busboy = require(process.argv[1]);
    assert.throws(() => new Busboy({headers: {
      'content-type': 'multipart/form-data; boundary=' + 'a'.repeat(300),
    }}), /length bigger than 256/);
    // A 252-byte boundary produces the 256-byte search needle from GHSA-xjh9-v7x6-24jw.
    const boundary = 'a'.repeat(252);
    const value = 'v'.repeat(512);
    const fields = [];
    const parser = new Busboy({headers: {'content-type': 'multipart/form-data; boundary=' + boundary}});
    const timer = setTimeout(() => { throw new Error('Multipart parser did not finish'); }, 2000);
    parser.on('error', error => { throw error; });
    parser.on('field', (name, value) => fields.push([name, value]));
    parser.on('finish', () => {
      assert.deepEqual(fields, [['field0', value], ['field1', value], ['field2', value]]);
      clearTimeout(timer);
    });
    const body = ['constructor', '__proto__', 'toString'].map((header, i) =>
      '--' + boundary + '\\r\\n' + header + ': test\\r\\nContent-Disposition: form-data; name="field' + i + '"\\r\\n\\r\\n' + value + '\\r\\n'
    ).join('') + '--' + boundary + '--\\r\\n';
    parser.end(body);
  `, path.join(root, 'backend/node_modules/@fastify/busboy'))
})
