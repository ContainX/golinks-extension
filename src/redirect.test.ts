import { describe, expect, it } from 'vitest'
import { buildRedirectRule, REDIRECT_RULE_ID } from './redirect'

/** Apply the built rule the way Chrome would, so the tests read as behavior. */
function redirect(
  input: { baseUrl: string | null; shortHost: string },
  url: string,
): string | null {
  const rule = buildRedirectRule(input)
  if (rule === null) return null
  const pattern = new RegExp(rule.condition.regexFilter ?? '')
  const match = pattern.exec(url)
  if (match === null) return null
  const substitution = rule.action.redirect?.regexSubstitution ?? ''
  return substitution.replace(/\\(\d)/g, (_, index: string) => match[Number(index)] ?? '')
}

const config = { baseUrl: 'https://links.example.com', shortHost: 'go' }

describe('buildRedirectRule', () => {
  it('produces one main_frame rule with a stable id', () => {
    const rule = buildRedirectRule(config)
    expect(rule?.id).toBe(REDIRECT_RULE_ID)
    expect(rule?.condition.resourceTypes).toEqual(['main_frame'])
    expect(rule?.action.type).toBe('redirect')
  })

  it('matches the short host and substitutes the base URL', () => {
    const rule = buildRedirectRule(config)
    expect(rule?.condition.regexFilter).toBe('^http://go/([^?#]*)(?:[?#].*)?$')
    expect(rule?.action.redirect?.regexSubstitution).toBe('https://links.example.com/\\1?via=ext')
  })

  it('builds nothing until a base URL is configured', () => {
    expect(buildRedirectRule({ baseUrl: null, shortHost: 'go' })).toBeNull()
    expect(buildRedirectRule({ baseUrl: '   ', shortHost: 'go' })).toBeNull()
    expect(buildRedirectRule({ baseUrl: 'not a url', shortHost: 'go' })).toBeNull()
  })

  it('refuses a short host that is not a bare host', () => {
    expect(buildRedirectRule({ ...config, shortHost: 'go/links' })).toBeNull()
    expect(buildRedirectRule({ ...config, shortHost: 'http://go' })).toBeNull()
    expect(buildRedirectRule({ ...config, shortHost: 'two words' })).toBeNull()
  })

  it('falls back to the default short host when the value is blank', () => {
    expect(buildRedirectRule({ ...config, shortHost: '  ' })?.condition.regexFilter).toBe(
      '^http://go/([^?#]*)(?:[?#].*)?$',
    )
  })

  it('escapes regex characters in the short host', () => {
    const rule = buildRedirectRule({ ...config, shortHost: 'go.corp' })
    expect(rule?.condition.regexFilter).toBe('^http://go\\.corp/([^?#]*)(?:[?#].*)?$')
    expect(new RegExp(rule?.condition.regexFilter ?? '').test('http://goxcorp/a')).toBe(false)
  })

  it('normalizes the base URL before building the substitution', () => {
    const rule = buildRedirectRule({ baseUrl: 'https://links.example.com/', shortHost: 'go' })
    expect(rule?.action.redirect?.regexSubstitution).toBe('https://links.example.com/\\1?via=ext')
  })

  it('keeps a base URL path prefix', () => {
    const rule = buildRedirectRule({ baseUrl: 'https://example.com/links', shortHost: 'go' })
    expect(rule?.action.redirect?.regexSubstitution).toBe('https://example.com/links/\\1?via=ext')
  })

  it('drops a query from a pasted base URL rather than nesting one', () => {
    const rule = buildRedirectRule({ baseUrl: 'https://example.com/?tenant=a', shortHost: 'go' })
    expect(rule?.action.redirect?.regexSubstitution).toBe('https://example.com/\\1?via=ext')
  })
})

describe('the rule applied to real addresses', () => {
  it('redirects a keyword', () => {
    expect(redirect(config, 'http://go/handbook')).toBe(
      'https://links.example.com/handbook?via=ext',
    )
  })

  it('redirects a namespaced keyword path with placeholder values', () => {
    expect(redirect(config, 'http://go/eng/ticket/1234')).toBe(
      'https://links.example.com/eng/ticket/1234?via=ext',
    )
  })

  it('redirects the bare short host to the directory', () => {
    expect(redirect(config, 'http://go/')).toBe('https://links.example.com/?via=ext')
  })

  it('drops a query typed against the short host and still records the source', () => {
    expect(redirect(config, 'http://go/handbook?page=2')).toBe(
      'https://links.example.com/handbook?via=ext',
    )
  })

  it('leaves https and other hosts alone', () => {
    expect(redirect(config, 'https://go/handbook')).toBeNull()
    expect(redirect(config, 'http://gone/handbook')).toBeNull()
    expect(redirect(config, 'http://go.example.com/handbook')).toBeNull()
  })

  it('leaves the short host with a port alone', () => {
    expect(redirect(config, 'http://go:8080/handbook')).toBeNull()
  })
})
