#!/usr/bin/env node
// Generates the RSA key pair that pins the extension id.
//
// Run this once for a distribution channel. The public key goes into the
// manifest's `key` field (already committed); the private key is written to
// .keys/extension-key.pem, which git ignores. Back that file up out of band:
// it is what signs a .crx for self-hosted updates. Losing it does not break
// the unpacked build, but a new key pair means a new extension id, and every
// deployment's EXTENSION_ORIGINS has to be updated to match.

import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const privatePath = join(root, '.keys', 'extension-key.pem')

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  console.error(
    `${privatePath} already exists. Pass --force to replace it (this changes the extension id).`,
  )
  process.exit(1)
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

mkdirSync(dirname(privatePath), { recursive: true })
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })

const spki = publicKey.export({ type: 'spki', format: 'der' })
console.log(`Private key written to ${privatePath}`)
console.log('')
console.log('Manifest "key" (base64 SPKI public key):')
console.log(spki.toString('base64'))
