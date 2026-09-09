// The action popup.
//
// One question, asked the moment it opens: does a link already point at this
// page? If it does, the popup hands over the short form. If it does not, it
// offers to make one. Nothing else is read from the tab, and the URL leaves
// the browser only to the configured deployment.

import { createLink, directoryUrl, findLinkForDestination, type Link, signInUrl } from '../api'
import { readConfig } from '../config'
import { presentError } from '../errors'
import { clear, copyWithFeedback, el, icon, iconButton } from '../ui/dom'
import { hostOf, joinUrl } from '../url'

const root = document.getElementById('root') as HTMLElement
const headerActions = document.getElementById('header-actions') as HTMLElement
const footer = document.getElementById('footer') as HTMLElement

interface Context {
  readonly baseUrl: string
  readonly shortHost: string
  readonly destination: string
}

/** The short form a member copies, e.g. `go/handbook`. */
function shortForm(link: Link, shortHost: string): string {
  return link.fullPath === '' ? `${shortHost}/${link.displayKeyword}` : link.fullPath
}

function render(...nodes: readonly Node[]): void {
  clear(root)
  root.append(...nodes)
}

function openTab(url: string): void {
  void chrome.tabs.create({ url })
  window.close()
}

function copyRow(value: string, link: Link, context: Context): HTMLElement {
  const copy = iconButton('Copy', 'copy', { class: 'primary' })
  copy.addEventListener('click', () => {
    void copyWithFeedback(copy, value)
  })

  const open = iconButton('Open in directory', 'open')
  open.addEventListener('click', () => {
    openTab(joinUrl(context.baseUrl, `_/links/${link.id}`))
  })

  return el('div', { class: 'row wrap' }, [copy, open])
}

function existingLinkView(link: Link, context: Context): readonly Node[] {
  const value = shortForm(link, context.shortHost)
  return [
    el('div', { class: 'stack-tight' }, [
      el('span', { class: 'micro-label' }, ['This page is']),
      el('span', { class: 'pill pill-accent' }, [value]),
    ]),
    copyRow(value, link, context),
  ]
}

function noticeView(message: string, action?: HTMLElement): readonly Node[] {
  const nodes: Node[] = [el('p', { class: 'notice' }, [message])]
  if (action !== undefined) nodes.push(el('div', { class: 'row' }, [action]))
  return nodes
}

function createFormView(context: Context): readonly Node[] {
  const input = el('input', {
    type: 'text',
    id: 'keyword',
    class: 'mono',
    placeholder: 'handbook',
    autocomplete: 'off',
    spellcheck: false,
  })

  const keywordWrap = el('div', { class: 'keyword-input' }, [
    el('span', { class: 'prefix' }, [`${context.shortHost}/`]),
    input,
  ])

  const keywordMessage = el('p', { class: 'message error', id: 'keyword-message' })
  keywordMessage.hidden = true

  const destination = el('input', {
    type: 'text',
    id: 'destination',
    readonly: true,
    value: context.destination,
  })
  const destinationMessage = el('p', { class: 'message error', id: 'destination-message' })
  destinationMessage.hidden = true

  const formMessage = el('p', { class: 'notice error', id: 'form-message' })
  formMessage.hidden = true

  const existing = el('div', { id: 'existing' })
  existing.hidden = true

  const submit = el('button', { type: 'submit', class: 'primary', id: 'create' }, ['Create'])

  const form = el('form', { id: 'create-form', class: 'stack' }, [
    el('div', { class: 'field' }, [
      el('label', { class: 'micro-label', for: 'keyword' }, ['Keyword']),
      keywordWrap,
      keywordMessage,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'micro-label', for: 'destination' }, ['Destination']),
      destination,
      destinationMessage,
    ]),
    formMessage,
    existing,
    el('div', { class: 'row' }, [submit]),
  ])

  const clearMessages = (): void => {
    for (const node of [keywordMessage, destinationMessage, formMessage, existing]) {
      node.hidden = true
    }
    keywordWrap.classList.remove('invalid')
    destination.classList.remove('invalid')
    clear(existing)
  }

  input.addEventListener('input', clearMessages)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const keyword = input.value.trim()
    if (keyword === '') {
      keywordWrap.classList.add('invalid')
      keywordMessage.textContent = 'Enter a keyword.'
      keywordMessage.hidden = false
      input.focus()
      return
    }

    clearMessages()
    submit.disabled = true
    submit.textContent = 'Creating…'

    void (async () => {
      const result = await createLink(context.baseUrl, {
        keyword,
        destination: context.destination,
      })

      if (result.kind === 'ok' && result.value !== null) {
        render(...existingLinkView(result.value, context))
        return
      }

      submit.disabled = false
      submit.textContent = 'Create'

      if (result.kind === 'ok') {
        formMessage.textContent = 'The link was created.'
        formMessage.hidden = false
        return
      }

      if (result.kind === 'unauthenticated') {
        render(...signedOutView(context.baseUrl))
        return
      }

      const shown = presentError(result, context.baseUrl)

      if (shown.existingLink !== null) {
        const link = shown.existingLink
        const value = shortForm(link, context.shortHost)
        const copy = iconButton('Copy', 'copy')
        copy.addEventListener('click', () => {
          void copyWithFeedback(copy, value)
        })
        existing.append(
          el('div', { class: 'card stack-tight' }, [
            el('p', {}, [shown.message]),
            el('div', { class: 'row spread' }, [el('span', { class: 'pill' }, [value]), copy]),
            el('span', { class: 'destination truncate' }, [link.destination]),
          ]),
        )
        existing.hidden = false
        keywordWrap.classList.add('invalid')
        input.focus()
        input.select()
        return
      }

      if (shown.placement === 'keyword') {
        keywordWrap.classList.add('invalid')
        keywordMessage.textContent = shown.message
        keywordMessage.hidden = false
        input.focus()
        return
      }

      if (shown.placement === 'destination') {
        destination.classList.add('invalid')
        destinationMessage.textContent = shown.message
        destinationMessage.hidden = false
        return
      }

      formMessage.textContent = shown.message
      formMessage.hidden = false
    })()
  })

  window.setTimeout(() => input.focus(), 0)

  return [el('p', { class: 'muted' }, ['No link points here yet.']), form]
}

function signedOutView(baseUrl: string): readonly Node[] {
  const button = el('button', { class: 'primary' }, ['Sign in'])
  button.addEventListener('click', () => {
    openTab(signInUrl(baseUrl))
  })
  return noticeView(`Sign in to ${hostOf(baseUrl)} to look up and create links.`, button)
}

function notConfiguredView(): readonly Node[] {
  const button = el('button', { class: 'primary' }, ['Open settings'])
  button.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage()
    window.close()
  })
  return noticeView('Set the address of your deployment to get started.', button)
}

function unsupportedTabView(): readonly Node[] {
  return noticeView('This page cannot be turned into a link.')
}

function renderFooter(baseUrl: string | null): void {
  clear(footer)
  const version = chrome.runtime.getManifest().version
  const settings = el('button', { class: 'link' }, ['Settings'])
  settings.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage()
    window.close()
  })
  footer.append(
    el('div', { class: 'row spread' }, [
      el('span', {}, [baseUrl === null ? `Version ${version}` : `${hostOf(baseUrl)} · ${version}`]),
      settings,
    ]),
  )
}

function renderHeaderActions(baseUrl: string | null): void {
  clear(headerActions)
  if (baseUrl === null) return
  const directory = el('button', {
    class: 'icon-only',
    title: 'Open the directory',
    'aria-label': 'Open the directory',
  })
  directory.append(icon('open'))
  directory.addEventListener('click', () => {
    openTab(directoryUrl(baseUrl))
  })
  headerActions.append(directory)
}

/**
 * The URL the popup is about. Normally the active tab; browser tests open the
 * popup page directly and pass `?tab=` because a real popup has no address a
 * driver can navigate to.
 */
async function currentTabUrl(): Promise<string | null> {
  const override = new URL(window.location.href).searchParams.get('tab')
  if (override !== null && override !== '') return override

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? null
  if (url === null) return null
  return /^https?:\/\//i.test(url) ? url : null
}

async function main(): Promise<void> {
  render(el('p', { class: 'muted' }, ['Checking…']))

  const config = await readConfig()
  renderHeaderActions(config.baseUrl)
  renderFooter(config.baseUrl)

  if (config.baseUrl === null) {
    render(...notConfiguredView())
    return
  }

  const destination = await currentTabUrl()
  if (destination === null) {
    render(...unsupportedTabView())
    return
  }

  const context: Context = {
    baseUrl: config.baseUrl,
    shortHost: config.shortHost,
    destination,
  }

  const result = await findLinkForDestination(config.baseUrl, destination)

  if (result.kind === 'unauthenticated') {
    render(...signedOutView(config.baseUrl))
    return
  }

  if (result.kind === 'unreachable') {
    const retry = el('button', {}, ['Try again'])
    retry.addEventListener('click', () => {
      void main()
    })
    render(...noticeView(`Can't reach ${hostOf(config.baseUrl)}`, retry))
    return
  }

  if (result.kind === 'error') {
    render(...noticeView(presentError(result, config.baseUrl).message))
    return
  }

  if (result.value !== null) {
    render(...existingLinkView(result.value, context))
    return
  }

  render(...createFormView(context))
}

void main()
