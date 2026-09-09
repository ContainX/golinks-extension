// Where the deployment's address comes from.
//
// Enterprise policy wins: a managed install gets `baseUrl` (and `shortHost`
// when it is not the default) from `storage.managed` and never shows setup.
// Everything else falls back to what the options page saved in
// `storage.local`. The organization title is cached locally so the options
// page can name the deployment without a request.

export const DEFAULT_SHORT_HOST = 'go'

export interface Config {
  /** null until a managed policy or the options page supplies one. */
  readonly baseUrl: string | null
  readonly shortHost: string
  readonly organizationTitle: string | null
  /** Which values policy supplied, so the options page can lock them. */
  readonly managed: { readonly baseUrl: boolean; readonly shortHost: boolean }
}

export interface StoredValues {
  readonly baseUrl?: unknown
  readonly shortHost?: unknown
  readonly organizationTitle?: unknown
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Merge policy over local storage. Pure, so the precedence rule is testable. */
export function resolveConfig(managed: StoredValues, local: StoredValues): Config {
  const managedBaseUrl = cleanString(managed.baseUrl)
  const managedShortHost = cleanString(managed.shortHost)

  return {
    baseUrl: managedBaseUrl ?? cleanString(local.baseUrl),
    shortHost: managedShortHost ?? cleanString(local.shortHost) ?? DEFAULT_SHORT_HOST,
    organizationTitle: cleanString(local.organizationTitle),
    managed: { baseUrl: managedBaseUrl !== null, shortHost: managedShortHost !== null },
  }
}

const KEYS = ['baseUrl', 'shortHost', 'organizationTitle'] as const

async function readArea(area: chrome.storage.StorageArea): Promise<StoredValues> {
  try {
    return (await area.get([...KEYS])) as StoredValues
  } catch {
    // `storage.managed` throws on platforms with no policy support.
    return {}
  }
}

export async function readConfig(): Promise<Config> {
  const [managed, local] = await Promise.all([
    readArea(chrome.storage.managed),
    readArea(chrome.storage.local),
  ])
  return resolveConfig(managed, local)
}

export async function writeLocalConfig(values: {
  baseUrl?: string | null
  shortHost?: string | null
  organizationTitle?: string | null
}): Promise<void> {
  const patch: Record<string, string> = {}
  const remove: string[] = []

  for (const key of KEYS) {
    const value = values[key]
    if (value === undefined) continue
    if (value === null || value.trim() === '') remove.push(key)
    else patch[key] = value.trim()
  }

  if (remove.length > 0) await chrome.storage.local.remove(remove)
  if (Object.keys(patch).length > 0) await chrome.storage.local.set(patch)
}

/** Call `listener` whenever policy or the options page changes what we read. */
export function onConfigChanged(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' && areaName !== 'managed') return
    if (KEYS.some((key) => key in changes)) listener()
  })
}
