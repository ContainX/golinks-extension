// Browser-test scaffolding.
//
// Every test gets its own Chromium profile with the unpacked build loaded, a
// throwaway HTTP server to act as a link destination, and helpers for the
// service's test sign-in. The extension id is pinned by the manifest key, so
// the origin the deployment allowlists is the same here as on any machine.

import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test'
import { SignJWT } from 'jose'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3999'
const TEST_SECRET = process.env.E2E_TEST_SECRET ?? 'development-only-test-sign-in-secret'
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'jane@widgets.test'

/** The id Chrome derives from the manifest key, read the same way the docs do. */
export const EXTENSION_ID = execFileSync(
  process.execPath,
  [join(root, 'scripts', 'extension-id.mjs')],
  { encoding: 'utf8' },
).trim()

/** A short-lived test sign-in token (spec 02 §8). */
export async function mintToken(email: string = TEST_EMAIL): Promise<string> {
  return await new SignJWT({ email, groups: [] })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('4m')
    .sign(new TextEncoder().encode(TEST_SECRET))
}

export interface DestinationServer {
  readonly url: (path: string) => string
  readonly close: () => Promise<void>
}

async function startDestinationServer(): Promise<DestinationServer> {
  const server: Server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html><title>Destination</title><h1 id="marker">${request.url}</h1>`)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no destination port')
  const origin = `http://127.0.0.1:${address.port}`

  return {
    url: (path) => `${origin}${path}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

export interface ExtensionFixtures {
  context: BrowserContext
  serviceWorker: Worker
  extensionId: string
  destination: DestinationServer
  /** Put a base URL in local storage and wait for the redirect rule to appear. */
  configure: (baseUrl?: string) => Promise<void>
  /** Sign in inside the browser context, so the session cookie is set. */
  signIn: (email?: string) => Promise<void>
  /** Create a link as the signed-in member, from a page on the canonical origin. */
  createLink: (keyword: string, destination: string) => Promise<void>
  /** Open the popup page directly, telling it which tab URL it is about. */
  openPopup: (tabUrl?: string) => Promise<import('@playwright/test').Page>
}

export const test = base.extend<ExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixture signature
  context: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'golinks-ext-'))
    const context = await chromium.launchPersistentContext(profile, {
      // The full Chromium build: extensions do not load in the headless shell.
      channel: 'chromium',
      headless: process.env.E2E_HEADED !== '1',
      args: [
        `--disable-extensions-except=${dist}`,
        `--load-extension=${dist}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    await use(context)

    await context.close()
    await rm(profile, { recursive: true, force: true })
  },

  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(worker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host)
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixture signature
  destination: async ({}, use) => {
    const server = await startDestinationServer()
    await use(server)
    await server.close()
  },

  configure: async ({ serviceWorker }, use) => {
    await use(async (baseUrl = BASE_URL) => {
      await serviceWorker.evaluate(async (value) => {
        await chrome.storage.local.set({ baseUrl: value })
      }, baseUrl)

      // The worker rebuilds the rule when storage changes; wait for it to land.
      await serviceWorker.evaluate(async () => {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const rules = await chrome.declarativeNetRequest.getDynamicRules()
          if (rules.length > 0) return
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('the redirect rule was never installed')
      })
    })
  },

  signIn: async ({ context }, use) => {
    await use(async (email = TEST_EMAIL) => {
      const token = await mintToken(email)
      const page = await context.newPage()
      await page.goto(`${BASE_URL}/_/auth/test-login?token=${encodeURIComponent(token)}`)
      await page.close()
    })
  },

  createLink: async ({ context }, use) => {
    await use(async (keyword, destination) => {
      const page = await context.newPage()
      await page.goto(`${BASE_URL}/_/health/live`)
      const status = await page.evaluate(
        async ([base, body]) => {
          const response = await fetch(`${base}/_/api/v1/links`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: body ?? '',
          })
          return `${response.status} ${await response.text()}`
        },
        [BASE_URL, JSON.stringify({ keyword, destination })] as const,
      )
      await page.close()
      if (!status.startsWith('201')) throw new Error(`could not create the link: ${status}`)
    })
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async (tabUrl) => {
      const query = tabUrl === undefined ? '' : `?tab=${encodeURIComponent(tabUrl)}`
      const page = await context.newPage()
      await page.goto(`chrome-extension://${extensionId}/popup.html${query}`)
      return page
    })
  },
})

export const expect = test.expect

/** A keyword the service's rules accept, unique per run. */
export function uniqueKeyword(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}
