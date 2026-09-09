// Where the deployment's address comes from.
//
// Three sources, in order: enterprise policy (`storage.managed`), then the
// values a deployment build baked into `deployment.json`, then what the
// options page saved in `storage.local`. Policy and a deployment build both
// lock the field, so a managed or purpose-built install never shows setup.
// The organization title is cached locally so the options page can name the
// deployment without a request.

export const DEFAULT_SHORT_HOST = 'go'

export type LockedBy = 'policy' | 'build' | null

export interface Config {
  /** null until policy, a deployment build, or the options page supplies one. */
  readonly baseUrl: string | null
  readonly shortHost: string
  readonly organizationTitle: string | null
  /** Which values were supplied above the options page, so it can lock them. */
  readonly managed: { readonly baseUrl: boolean; readonly shortHost: boolean }
  /** What locked `baseUrl`, for the options page's explanation. */
  readonly lockedBy: LockedBy
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

/**
 * Merge policy over the deployment build's defaults over local storage. Pure,
 * so the precedence rule is testable.
 */
export function resolveConfig(
  managed: StoredValues,
  local: StoredValues,
  baked: StoredValues = {},
): Config {
  const managedBaseUrl = cleanString(managed.baseUrl)
  const managedShortHost = cleanString(managed.shortHost)
  const bakedBaseUrl = cleanString(baked.baseUrl)
  const bakedShortHost = cleanString(baked.shortHost)

  const lockedBy: LockedBy =
    managedBaseUrl !== null ? 'policy' : bakedBaseUrl !== null ? 'build' : null

  return {
    baseUrl: managedBaseUrl ?? bakedBaseUrl ?? cleanString(local.baseUrl),
    shortHost:
      managedShortHost ?? bakedShortHost ?? cleanString(local.shortHost) ?? DEFAULT_SHORT_HOST,
    organizationTitle: cleanString(local.organizationTitle),
    managed: {
      baseUrl: lockedBy !== null,
      shortHost: managedShortHost !== null || bakedShortHost !== null,
    },
    lockedBy,
  }
}

/** The file a deployment build writes next to the manifest; absent in a generic build. */
export const DEPLOYMENT_FILE = 'deployment.json'

let bakedDefaults: Promise<StoredValues> | undefined

async function readBakedDefaults(): Promise<StoredValues> {
  bakedDefaults ??= (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL(DEPLOYMENT_FILE))
      if (!response.ok) return {}
      const parsed: unknown = await response.json()
      return typeof parsed === 'object' && parsed !== null ? (parsed as StoredValues) : {}
    } catch {
      return {}
    }
  })()
  return bakedDefaults
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
  const [managed, local, baked] = await Promise.all([
    readArea(chrome.storage.managed),
    readArea(chrome.storage.local),
    readBakedDefaults(),
  ])
  return resolveConfig(managed, local, baked)
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
