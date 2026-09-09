import { describe, expect, it } from 'vitest'
import { DEFAULT_SHORT_HOST, resolveConfig } from './config'

describe('resolveConfig', () => {
  it('defaults the short host and leaves the base URL unset', () => {
    const config = resolveConfig({}, {})
    expect(config.baseUrl).toBeNull()
    expect(config.shortHost).toBe(DEFAULT_SHORT_HOST)
    expect(config.managed).toEqual({ baseUrl: false, shortHost: false })
  })

  it('reads values the options page saved', () => {
    const config = resolveConfig({}, { baseUrl: 'https://links.example.com', shortHost: 'g' })
    expect(config.baseUrl).toBe('https://links.example.com')
    expect(config.shortHost).toBe('g')
    expect(config.managed.baseUrl).toBe(false)
  })

  it('prefers policy over local storage and flags the locked values', () => {
    const config = resolveConfig(
      { baseUrl: 'https://policy.example.com' },
      { baseUrl: 'https://typed.example.com', shortHost: 'g' },
    )
    expect(config.baseUrl).toBe('https://policy.example.com')
    expect(config.shortHost).toBe('g')
    expect(config.managed).toEqual({ baseUrl: true, shortHost: false })
  })

  it('locks the short host when policy sets it', () => {
    const config = resolveConfig({ shortHost: 'links' }, { shortHost: 'go' })
    expect(config.shortHost).toBe('links')
    expect(config.managed.shortHost).toBe(true)
  })

  it('ignores blank and non-string values', () => {
    const config = resolveConfig({ baseUrl: '   ' }, { baseUrl: 42, shortHost: '' })
    expect(config.baseUrl).toBeNull()
    expect(config.shortHost).toBe(DEFAULT_SHORT_HOST)
    expect(config.managed.baseUrl).toBe(false)
  })

  it('keeps the cached organization title', () => {
    const config = resolveConfig({}, { organizationTitle: 'Widgets' })
    expect(config.organizationTitle).toBe('Widgets')
  })
})
