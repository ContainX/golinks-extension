// The popup: look the current page up, offer to create a link for it, and say
// plainly when the member is signed out.

import { expect, test, uniqueKeyword } from './fixtures'

test('creates a link for the page the member is on', async ({
  configure,
  signIn,
  destination,
  openPopup,
}) => {
  await configure()
  await signIn()

  const keyword = uniqueKeyword('popup')
  const tabUrl = destination.url(`/page/${keyword}`)
  const popup = await openPopup(tabUrl)

  await expect(popup.getByText('No link points here yet.')).toBeVisible()
  await expect(popup.locator('#destination')).toHaveValue(tabUrl)

  await popup.locator('#keyword').fill(keyword)
  await popup.locator('#create').click()

  await expect(popup.getByText('This page is')).toBeVisible()
  await expect(popup.locator('.pill')).toHaveText(`go/${keyword}`)
})

test('shows the short form when a link already points at the page', async ({
  configure,
  signIn,
  createLink,
  destination,
  openPopup,
}) => {
  await configure()
  await signIn()

  const keyword = uniqueKeyword('known')
  const tabUrl = destination.url(`/page/${keyword}`)
  await createLink(keyword, tabUrl)

  const popup = await openPopup(tabUrl)

  await expect(popup.locator('.pill')).toHaveText(`go/${keyword}`)
  await expect(popup.getByRole('button', { name: 'Copy' })).toBeVisible()
  await expect(popup.getByRole('button', { name: 'Open in directory' })).toBeVisible()
})

test('reports a keyword that is already taken, with the link that holds it', async ({
  configure,
  signIn,
  createLink,
  destination,
  openPopup,
}) => {
  await configure()
  await signIn()

  const keyword = uniqueKeyword('taken')
  await createLink(keyword, destination.url(`/first/${keyword}`))

  const popup = await openPopup(destination.url(`/second/${keyword}`))
  await popup.locator('#keyword').fill(keyword)
  await popup.locator('#create').click()

  await expect(popup.locator('#existing')).toBeVisible()
  await expect(popup.locator('#existing .pill')).toHaveText(`go/${keyword}`)
})

test('offers to sign in when the member is signed out', async ({
  configure,
  destination,
  openPopup,
}) => {
  await configure()

  const popup = await openPopup(destination.url('/anything'))

  await expect(popup.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(popup.locator('#create-form')).toHaveCount(0)
})

test('points at the options page before a deployment is configured', async ({ openPopup }) => {
  const popup = await openPopup('https://example.com/whatever')

  await expect(popup.getByText('Set the address of your deployment to get started.')).toBeVisible()
  await expect(popup.getByRole('button', { name: 'Open settings' })).toBeVisible()
})
