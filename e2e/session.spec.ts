// Spec 12 §2: the member's ordinary session cookie has to accompany requests
// the extension makes. This is the check that milestone depends on.

import { BASE_URL, expect, TEST_EMAIL, test } from './fixtures'

test('the API sees the session on a request made from the extension', async ({
  configure,
  signIn,
  serviceWorker,
}) => {
  await configure()
  await signIn()

  const response = await serviceWorker.evaluate(async (base) => {
    const result = await fetch(`${base}/_/api/v1/me`, { credentials: 'include' })
    return { status: result.status, body: (await result.json()) as { user?: { email?: string } } }
  }, BASE_URL)

  expect(response.status).toBe(200)
  expect(response.body.user?.email).toBe(TEST_EMAIL)
})

test('the API reports 401 to the extension when nobody is signed in', async ({
  configure,
  serviceWorker,
}) => {
  await configure()

  const status = await serviceWorker.evaluate(async (base) => {
    const result = await fetch(`${base}/_/api/v1/me`, { credentials: 'include' })
    return result.status
  }, BASE_URL)

  expect(status).toBe(401)
})
