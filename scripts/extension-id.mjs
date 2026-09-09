#!/usr/bin/env node
// Prints the extension id that Chrome derives from the manifest's `key` field.
//
// Chrome hashes the DER public key with SHA-256 and maps the first 32 hex
// digits onto the alphabet a-p (0 -> a, 1 -> b, ... f -> p).

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function extensionIdFromKey(base64Spki) {
  const digest = createHash('sha256').update(Buffer.from(base64Spki, 'base64')).digest('hex')
  return digest
    .slice(0, 32)
    .split('')
    .map((hex) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(hex, 16)))
    .join('')
}

const manifest = JSON.parse(readFileSync(join(root, 'src', 'manifest.json'), 'utf8'))
if (!manifest.key) {
  console.error('src/manifest.json has no "key" field, so the id is not pinned.')
  process.exit(1)
}

const id = extensionIdFromKey(manifest.key)
if (process.argv.includes('--origin')) {
  console.log(`chrome-extension://${id}`)
} else {
  console.log(id)
}
