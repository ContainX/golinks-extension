// URL handling shared by the redirect rule, the omnibox, and the API client.
// Everything here is pure so it can be exercised without a browser.

/**
 * Accept the base URL the way a member types it and return a canonical origin
 * with any path prefix kept and the trailing slash removed. Returns null when
 * the text is not a usable http(s) URL.
 */
export function normalizeBaseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (parsed.hostname === '') return null

  const path = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.origin}${path}`
}

/** The origin of a base URL, which is the pattern host permissions are asked for. */
export function originOf(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin
  } catch {
    return null
  }
}

/** The host of a URL, for the "Can't reach <host>" message and suggestion text. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** The `<origin>/*` match pattern the options page requests permission for. */
export function originPattern(baseUrl: string): string | null {
  const origin = originOf(baseUrl)
  return origin === null ? null : `${origin}/*`
}

/** The `http://<shortHost>/*` match pattern the redirect rule needs. */
export function shortHostPattern(shortHost: string): string {
  return `http://${shortHost}/*`
}

/**
 * Join a path onto a base URL. The path is treated as already-escaped path
 * segments, so a keyword containing `/` keeps its shape.
 */
export function joinUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.replace(/^\/+/, '')
  const url = `${base}/${suffix}`
  if (params === undefined) return url

  const query = new URLSearchParams(params).toString()
  if (query === '') return url
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

/** Percent-encode a keyword path, leaving the `/` between segments alone. */
export function encodeKeywordPath(keyword: string): string {
  return keyword
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}
