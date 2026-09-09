// The `go` omnibox keyword.
//
// Typing `go handbook` and pressing Enter navigates the current tab the same
// way the address bar would, and while the member types, the deployment
// offers matching keywords. Suggestions are a courtesy: they are debounced,
// and every failure — offline, signed out, a slow request the member has
// already typed past — is silent.

import { type Link, suggestLinks } from './api'
import { encodeKeywordPath, hostOf, joinUrl } from './url'

export const SUGGESTION_LIMIT = 5
export const SUGGESTION_DEBOUNCE_MS = 150

/**
 * Turn what the member typed into a keyword path.
 *
 * The text is trimmed, and a `go/` or `<shortHost>/` prefix typed out of habit
 * is dropped, so `go go/handbook` and `go handbook` mean the same thing. A
 * keyword cannot contain spaces, so text with spaces is passed through as
 * typed and the resolver's miss flow offers to create it.
 */
export function parseOmniboxInput(text: string, shortHost: string): string {
  let keyword = text.trim().replace(/^\/+/, '')

  const prefixes = new Set(['go/', `${shortHost.trim().toLowerCase()}/`])
  for (let stripped = true; stripped; ) {
    stripped = false
    for (const prefix of prefixes) {
      if (prefix !== '/' && keyword.toLowerCase().startsWith(prefix)) {
        keyword = keyword.slice(prefix.length)
        stripped = true
      }
    }
  }

  return keyword.trim()
}

/**
 * Where Enter goes. An empty keyword opens the directory; anything else goes
 * through the resolver so the visit is recorded.
 */
export function navigationUrl(baseUrl: string, text: string, shortHost: string): string {
  const keyword = parseOmniboxInput(text, shortHost)
  if (keyword === '') return joinUrl(baseUrl, '')
  return joinUrl(baseUrl, encodeKeywordPath(keyword), { via: 'ext' })
}

/** The line Chrome shows under the address bar for one existing link. */
export function formatSuggestion(link: Link, shortHost: string): string {
  const shortForm = link.fullPath === '' ? link.displayKeyword : link.fullPath
  const prefix = link.fullPath === '' ? `${shortHost}/` : ''
  return `${prefix}${shortForm} — ${hostOf(link.destination)}`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Chrome's suggestion description is XML; keywords are set apart with <match>. */
export function suggestionDescription(link: Link, shortHost: string): string {
  const [shortForm, host] = formatSuggestion(link, shortHost).split(' — ')
  return `<match>${escapeXml(shortForm ?? '')}</match> <dim>—</dim> <url>${escapeXml(host ?? '')}</url>`
}

/** Where Chrome wants the navigation to land. */
export type OmniboxDisposition = 'currentTab' | 'newForegroundTab' | 'newBackgroundTab'

export interface OmniboxDeps {
  readonly readConfig: () => Promise<{ baseUrl: string | null; shortHost: string }>
  readonly navigate: (url: string, disposition: OmniboxDisposition) => void
}

export function registerOmnibox(deps: OmniboxDeps): void {
  let debounce: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  chrome.omnibox.setDefaultSuggestion({
    description: 'Go to <match>go/%s</match>',
  })

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    if (debounce !== undefined) clearTimeout(debounce)
    inFlight?.abort()

    debounce = setTimeout(() => {
      void (async () => {
        const config = await deps.readConfig()
        const keyword = parseOmniboxInput(text, config.shortHost)
        if (config.baseUrl === null || keyword === '') {
          suggest([])
          return
        }

        const controller = new AbortController()
        inFlight = controller
        const result = await suggestLinks(
          config.baseUrl,
          keyword,
          SUGGESTION_LIMIT,
          controller.signal,
        )
        // Signed out, offline, or an error: say nothing rather than nag.
        if (result.kind !== 'ok') {
          suggest([])
          return
        }

        suggest(
          result.value.slice(0, SUGGESTION_LIMIT).map((link) => ({
            content: link.fullPath === '' ? link.displayKeyword : link.fullPath,
            description: suggestionDescription(link, config.shortHost),
          })),
        )
      })()
    }, SUGGESTION_DEBOUNCE_MS)
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    void (async () => {
      const config = await deps.readConfig()
      if (config.baseUrl === null) {
        deps.navigate(chrome.runtime.getURL('options.html'), disposition)
        return
      }
      deps.navigate(navigationUrl(config.baseUrl, text, config.shortHost), disposition)
    })()
  })

  chrome.omnibox.onInputCancelled.addListener(() => {
    if (debounce !== undefined) clearTimeout(debounce)
    inFlight?.abort()
  })
}
