#!/usr/bin/env node
// Builds the unpacked extension into dist/, and optionally the store zip.
//
//   node scripts/build.mjs                unpacked build
//   node scripts/build.mjs --watch        rebuild on change
//   node scripts/build.mjs --zip          unpacked build plus golinks-extension.zip
//   node scripts/build.mjs --grant-hosts  test build with host access pre-granted
//   BASE_URL=https://links.example.com node scripts/build.mjs --zip
//                                         deployment build: the service's address is
//                                         baked in and its host access is a required
//                                         permission, so a force-install needs no setup
//
// `--grant-hosts` promotes the optional host permissions to required ones. A
// released build asks for them from the options page, and that prompt is
// browser UI no test driver can click, so the browser tests build this way.
// Never ship the result: `pnpm build` always rebuilds dist/ from scratch.

import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import * as esbuild from 'esbuild'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const dist = join(root, 'dist')
const watch = process.argv.includes('--watch')
const zip = process.argv.includes('--zip')
const grantHosts = process.argv.includes('--grant-hosts')
const deploymentBaseUrl = readDeploymentBaseUrl()
const deploymentShortHost = (process.env.SHORT_HOST ?? 'go').trim() || 'go'

function readDeploymentBaseUrl() {
  const index = process.argv.indexOf('--base-url')
  const raw = index === -1 ? process.env.BASE_URL : process.argv[index + 1]
  if (raw === undefined || raw.trim() === '') return null
  let url
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error(`BASE_URL is not a URL: ${raw}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`BASE_URL must be http(s): ${raw}`)
  }
  return url.origin
}

const ENTRY_POINTS = {
  background: join(src, 'background.ts'),
  popup: join(src, 'popup', 'popup.ts'),
  options: join(src, 'options', 'options.ts'),
}

const STATIC_FILES = [
  ['manifest.json', 'manifest.json'],
  ['managed_schema.json', 'managed_schema.json'],
  ['popup/popup.html', 'popup.html'],
  ['options/options.html', 'options.html'],
  ['ui/ui.css', 'ui.css'],
]

async function copyStatic() {
  for (const [from, to] of STATIC_FILES) {
    await cp(join(src, from), join(dist, to))
  }
  await cp(join(src, 'icons'), join(dist, 'icons'), { recursive: true })
}

/** Keep the manifest version and the package version from drifting apart. */
async function finishManifest() {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const manifestPath = join(dist, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  let changed = false

  if (manifest.version !== pkg.version) {
    manifest.version = pkg.version
    changed = true
  }

  if (grantHosts && manifest.optional_host_permissions !== undefined) {
    manifest.host_permissions = manifest.optional_host_permissions
    delete manifest.optional_host_permissions
    changed = true
  }

  // A deployment build knows its service, so host access for it (and for the short
  // host) is declared up front; Chrome grants required permissions at install, and a
  // force-install therefore needs no click. The address itself rides along in
  // deployment.json, which config.ts reads below policy and above the options page.
  if (deploymentBaseUrl !== null) {
    const required = new Set(manifest.host_permissions ?? [])
    required.add(`http://${deploymentShortHost}/*`)
    required.add(`${deploymentBaseUrl}/*`)
    manifest.host_permissions = [...required]
    await writeFile(
      join(dist, 'deployment.json'),
      `${JSON.stringify({ baseUrl: deploymentBaseUrl, shortHost: deploymentShortHost }, null, 2)}\n`,
    )
    changed = true
  }

  if (changed) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

const options = {
  entryPoints: ENTRY_POINTS,
  entryNames: '[name]',
  outdir: dist,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  platform: 'browser',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  legalComments: 'none',
  logLevel: 'info',
}

async function build() {
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await esbuild.build(options)
  await copyStatic()
  await finishManifest()
}

if (watch) {
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  const context = await esbuild.context({
    ...options,
    plugins: [
      {
        name: 'copy-static',
        setup(build) {
          build.onEnd(async () => {
            await copyStatic()
            await finishManifest()
          })
        },
      },
    ],
  })
  await context.watch()
  console.log(`watching, output in ${dist}`)
} else {
  await build()
  if (zip) {
    const archive = join(root, 'golinks-extension.zip')
    await rm(archive, { force: true })
    // `zip` ships with macOS and every Linux image CI uses.
    await run('zip', ['-r', '-q', '-X', archive, '.'], { cwd: dist })
    console.log(`wrote ${archive}`)
  }
  const { stdout } = await run(process.execPath, [join(root, 'scripts', 'extension-id.mjs')])
  console.log(`extension id ${stdout.trim()}`)
  if (deploymentBaseUrl !== null) {
    console.log(`deployment build for ${deploymentBaseUrl} (short host ${deploymentShortHost})`)
  }
}
