// The options page.
//
// One field, because there is one thing to say: where the deployment lives.
// Saving asks for the two host permissions the extension needs — the short
// host it redirects, and the deployment whose session it borrows — and then
// asks the deployment who the member is. A managed install has all of this
// from policy and shows it locked.

import { getMe, signInUrl } from '../api'
import { type Config, readConfig, writeLocalConfig } from '../config'
import { clear, el, icon } from '../ui/dom'
import { hostOf, normalizeBaseUrl, originPattern, shortHostPattern } from '../url'

const form = document.getElementById('deployment-form') as HTMLFormElement
const input = document.getElementById('base-url') as HTMLInputElement
const message = document.getElementById('base-url-message') as HTMLParagraphElement
const save = document.getElementById('save') as HTMLButtonElement
const status = document.getElementById('status') as HTMLElement
const permissionNote = document.getElementById('permission-note') as HTMLElement
const deploymentHelp = document.getElementById('deployment-help') as HTMLElement

document.getElementById('mark')?.append(icon('arrow'))

function showFieldError(value: string | null): void {
  if (value === null) {
    message.hidden = true
    input.classList.remove('invalid')
    return
  }
  message.textContent = value
  message.hidden = false
  input.classList.add('invalid')
}

function statusRow(label: string, value: Node | string): readonly Node[] {
  return [
    el('span', { class: 'micro-label' }, [label]),
    typeof value === 'string' ? el('span', {}, [value]) : value,
  ]
}

function renderStatus(nodes: readonly Node[]): void {
  clear(status)
  status.append(el('div', { class: 'status-grid' }, nodes))
}

function renderMessageStatus(nodes: readonly Node[]): void {
  clear(status)
  status.append(...nodes)
}

async function refreshStatus(config: Config): Promise<void> {
  if (config.baseUrl === null) {
    renderMessageStatus([el('p', { class: 'muted' }, ['Not connected to a deployment yet.'])])
    return
  }

  renderMessageStatus([el('p', { class: 'muted' }, ['Checking…'])])

  const result = await getMe(config.baseUrl)

  if (result.kind === 'unreachable') {
    renderMessageStatus([
      el('p', { class: 'notice error' }, [`Can't reach ${hostOf(config.baseUrl)}`]),
    ])
    return
  }

  if (result.kind === 'unauthenticated') {
    const link = el('a', { href: signInUrl(config.baseUrl), target: '_blank', rel: 'noreferrer' }, [
      'Sign in',
    ])
    renderMessageStatus([
      el('p', {}, [
        el('span', { class: 'muted' }, [`You are signed out of ${hostOf(config.baseUrl)}. `]),
        link,
      ]),
    ])
    return
  }

  if (result.kind === 'error') {
    renderMessageStatus([el('p', { class: 'notice error' }, [result.error.message])])
    return
  }

  const me = result.value

  // The deployment is the authority on its own short host and title; cache
  // them so the popup and the redirect rule do not need a request.
  if (!config.managed.shortHost && me.app.shortHost !== '') {
    await writeLocalConfig({ shortHost: me.app.shortHost })
  }
  await writeLocalConfig({ organizationTitle: me.organization.branding.title })

  const shortHost = config.managed.shortHost
    ? config.shortHost
    : me.app.shortHost === ''
      ? config.shortHost
      : me.app.shortHost

  renderStatus([
    ...statusRow('Signed in as', me.user.email),
    ...statusRow('Organization', me.organization.branding.title ?? hostOf(config.baseUrl)),
    ...statusRow('Short host', el('span', { class: 'pill' }, [`${shortHost}/`])),
    ...statusRow('Service version', me.app.version === '' ? 'unknown' : me.app.version),
    ...statusRow('Extension version', chrome.runtime.getManifest().version),
  ])
}

function lockField(config: Config): void {
  input.value = config.baseUrl ?? ''
  input.readOnly = true
  save.hidden = true
  permissionNote.hidden = true
  deploymentHelp.replaceChildren(
    el('span', { class: 'locked' }, ['Set by policy']),
    el('span', { class: 'muted' }, [
      ' Your organization configures this extension. Nothing to do here.',
    ]),
  )
}

async function connect(baseUrl: string, shortHost: string): Promise<void> {
  const origin = originPattern(baseUrl)
  if (origin === null) {
    showFieldError('That does not look like a web address.')
    return
  }

  // Must run inside the click that started this, so no await comes first.
  const granted = await chrome.permissions.request({
    origins: [shortHostPattern(shortHost), origin],
  })

  if (!granted) {
    showFieldError(
      'Both permissions are needed: one to redirect the short host, one to use your session.',
    )
    return
  }

  await writeLocalConfig({ baseUrl })
  await refreshStatus(await readConfig())
}

async function main(): Promise<void> {
  const config = await readConfig()

  if (config.managed.baseUrl) {
    lockField(config)
  } else {
    input.value = config.baseUrl ?? ''
  }

  void refreshStatus(config)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    showFieldError(null)

    const baseUrl = normalizeBaseUrl(input.value)
    if (baseUrl === null) {
      showFieldError('Enter the address of your deployment, for example https://links.example.com.')
      input.focus()
      return
    }

    input.value = baseUrl
    save.disabled = true
    save.textContent = 'Connecting…'

    void connect(baseUrl, config.shortHost).finally(() => {
      save.disabled = false
      save.textContent = 'Save and connect'
    })
  })
}

void main()
