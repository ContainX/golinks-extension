// The slice of the HTTP API this extension uses.
//
// The types below are the extension's own declarations of the fields it reads,
// not a copy of the service's schemas: the extension is built and released on
// its own schedule and shares no code with the deployment it talks to. Keyword
// validation is likewise the service's job; failures come back in the error
// envelope and are shown as they arrive.

import { joinUrl } from './url'

export interface Link {
  readonly id: string
  readonly fullPath: string
  readonly displayKeyword: string
  readonly namespace: string
  readonly destination: string
}

export interface LinkList {
  readonly items: readonly Link[]
  readonly nextCursor: string | null
}

export interface Me {
  readonly user: { readonly email: string }
  readonly organization: { readonly branding: { readonly title: string | null } }
  readonly app: { readonly shortHost: string; readonly version: string }
}

export interface ApiErrorEnvelope {
  readonly code: string
  readonly message: string
  readonly fields: Readonly<Record<string, string>>
  readonly existingLink: Link | null
}

/**
 * Every call resolves. A signed-out member is a normal outcome, not an
 * exception, and so is an unreachable deployment; both have their own shape so
 * callers cannot forget them.
 */
export type ApiResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'error'; readonly status: number; readonly error: ApiErrorEnvelope }
  | { readonly kind: 'unreachable' }

const API_PREFIX = '_/api/v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/** Read a Link out of an untrusted body, keeping only the fields we use. */
export function parseLink(value: unknown): Link | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string') return null
  return {
    id: value.id,
    fullPath: asString(value.fullPath, ''),
    displayKeyword: asString(value.displayKeyword, ''),
    namespace: asString(value.namespace, ''),
    destination: asString(value.destination, ''),
  }
}

/** Read the list envelope, `{ items, nextCursor }`. */
export function parseLinkList(value: unknown): LinkList {
  const items: Link[] = []
  if (isRecord(value) && Array.isArray(value.items)) {
    for (const entry of value.items) {
      const link = parseLink(entry)
      if (link !== null) items.push(link)
    }
  }
  const cursor = isRecord(value) ? value.nextCursor : null
  return { items, nextCursor: typeof cursor === 'string' ? cursor : null }
}

/** Read the error envelope, `{ error: { code, message, details, existingLink } }`. */
export function parseErrorEnvelope(value: unknown, status: number): ApiErrorEnvelope {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {}
  const details = isRecord(error.details) ? error.details : {}
  const rawFields = isRecord(details.fields) ? details.fields : {}

  const fields: Record<string, string> = {}
  for (const [key, message] of Object.entries(rawFields)) {
    if (typeof message === 'string') fields[key] = message
  }

  return {
    code: asString(error.code, status === 0 ? 'unreachable' : 'internal_error'),
    message: asString(error.message, ''),
    fields,
    existingLink: parseLink(error.existingLink),
  }
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST'
  readonly params?: Record<string, string>
  readonly body?: unknown
  readonly signal?: AbortSignal
}

async function request<T>(
  baseUrl: string,
  path: string,
  parse: (value: unknown) => T,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const url = joinUrl(baseUrl, `${API_PREFIX}/${path}`, options.params)

  const init: RequestInit = {
    method: options.method ?? 'GET',
    // The member's ordinary session cookie rides along; the extension never
    // sees a credential of its own.
    credentials: 'include',
    headers: { Accept: 'application/json' },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  }

  if (options.body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    return { kind: 'unreachable' }
  }

  if (response.status === 401) return { kind: 'unauthenticated' }

  let payload: unknown = null
  if (response.status !== 204) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    return {
      kind: 'error',
      status: response.status,
      error: parseErrorEnvelope(payload, response.status),
    }
  }

  return { kind: 'ok', value: parse(payload) }
}

export function getMe(baseUrl: string, signal?: AbortSignal): Promise<ApiResult<Me>> {
  return request(
    baseUrl,
    'me',
    (value): Me => {
      const root = isRecord(value) ? value : {}
      const user = isRecord(root.user) ? root.user : {}
      const organization = isRecord(root.organization) ? root.organization : {}
      const branding = isRecord(organization.branding) ? organization.branding : {}
      const app = isRecord(root.app) ? root.app : {}
      return {
        user: { email: asString(user.email, '') },
        organization: {
          branding: {
            title: typeof branding.title === 'string' ? branding.title : null,
          },
        },
        app: {
          shortHost: asString(app.shortHost, ''),
          version: asString(app.version, ''),
        },
      }
    },
    signal === undefined ? {} : { signal },
  )
}

/** "Is there already a link for this page?" — one exact-match request. */
export function findLinkForDestination(
  baseUrl: string,
  destination: string,
  signal?: AbortSignal,
): Promise<ApiResult<Link | null>> {
  return request(baseUrl, 'links', (value) => parseLinkList(value).items[0] ?? null, {
    params: { destination, limit: '1' },
    ...(signal === undefined ? {} : { signal }),
  })
}

export function suggestLinks(
  baseUrl: string,
  keyword: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ApiResult<readonly Link[]>> {
  return request(baseUrl, 'links/suggestions', (value) => parseLinkList(value).items, {
    params: { keyword, limit: String(limit) },
    ...(signal === undefined ? {} : { signal }),
  })
}

export function createLink(
  baseUrl: string,
  input: { keyword: string; destination: string },
): Promise<ApiResult<Link | null>> {
  return request(baseUrl, 'links', parseLink, {
    method: 'POST',
    body: { keyword: input.keyword, destination: input.destination },
  })
}

/** The page that starts a sign-in, opened in a tab from the popup. */
export function signInUrl(baseUrl: string): string {
  return joinUrl(baseUrl, '_/auth/login', { redirectTo: '/' })
}

/** The directory, where the omnibox lands on empty input and Copy links out to. */
export function directoryUrl(baseUrl: string): string {
  return joinUrl(baseUrl, '')
}
