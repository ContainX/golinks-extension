// The short-host redirect, end to end: typing go/<keyword> in a browser that
// has never heard of the deployment's DNS still lands on the destination.

import { BASE_URL, EXTENSION_ID, expect, test, uniqueKeyword } from './fixtures'

test('the extension id is pinned by the manifest key', async ({ extensionId }) => {
  expect(extensionId).toBe(EXTENSION_ID)
})

test('go/<keyword> lands on the destination', async ({
  configure,
  signIn,
  createLink,
  destination,
  context,
}) => {
  await configure()
  await signIn()

  const keyword = uniqueKeyword('handbook')
  const target = destination.url(`/${keyword}`)
  await createLink(keyword, target)

  const page = await context.newPage()
  await page.goto(`http://go/${keyword}`)

  expect(page.url()).toBe(target)
  await expect(page.locator('#marker')).toHaveText(`/${keyword}`)
})

test('the redirect records the extension as the source', async ({
  configure,
  signIn,
  createLink,
  destination,
  context,
}) => {
  await configure()
  await signIn()

  const keyword = uniqueKeyword('source')
  await createLink(keyword, destination.url(`/${keyword}`))

  const requests: string[] = []
  const page = await context.newPage()
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(`http://go/${keyword}`)

  expect(requests).toContain(`${BASE_URL}/${keyword}?via=ext`)
})

test('no rule is installed until a base URL is configured', async ({ serviceWorker }) => {
  const rules = await serviceWorker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
  expect(rules).toEqual([])
})
