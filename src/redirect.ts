// The short-host redirect.
//
// One dynamic declarativeNetRequest rule turns `http://<shortHost>/<path>`
// into `<baseUrl>/<path>?via=ext` before the browser looks the host up, so
// `go/handbook` works on a laptop that has never heard of the deployment's
// DNS. It needs no network of its own, which is why it keeps working when the
// deployment is unreachable.

import { DEFAULT_SHORT_HOST } from './config'
import { joinUrl, normalizeBaseUrl } from './url'

export const REDIRECT_RULE_ID = 1

export interface RedirectRuleInput {
  readonly baseUrl: string | null
  readonly shortHost: string
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build the rule, or null when there is nothing to redirect to yet.
 *
 * The capture stops at `?` and `#` and the substitution appends `via=ext`
 * itself. Query parameters typed against the short host are dropped, which
 * costs nothing: the resolver reads the path and `via`, and ignores the rest.
 * Doing it this way is what lets a single static substitution always join the
 * parameter with the right separator.
 */
export function buildRedirectRule(
  input: RedirectRuleInput,
): chrome.declarativeNetRequest.Rule | null {
  const baseUrl = input.baseUrl === null ? null : normalizeBaseUrl(input.baseUrl)
  if (baseUrl === null) return null

  const shortHost = input.shortHost.trim() || DEFAULT_SHORT_HOST
  // A short host with a slash, a scheme, or whitespace is not a host at all.
  if (/[\s/\\:?#]/.test(shortHost)) return null

  return {
    id: REDIRECT_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      // joinUrl picks `?` or `&`; a normalized base URL carries no query and
      // the capture stops before one, so in practice this is always `?`.
      redirect: { regexSubstitution: joinUrl(baseUrl, '\\1', { via: 'ext' }) },
    },
    condition: {
      regexFilter: `^http://${escapeForRegex(shortHost)}/([^?#]*)(?:[?#].*)?$`,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  }
}

/**
 * Put the current rule in place, replacing whatever was there. Called at
 * service-worker startup, on install, and whenever the configuration changes,
 * so the rule and the configuration can never drift apart.
 */
export async function syncRedirectRule(input: RedirectRuleInput): Promise<void> {
  const rule = buildRedirectRule(input)
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE_ID],
    addRules: rule === null ? [] : [rule],
  })
}
