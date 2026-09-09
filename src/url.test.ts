import { describe, expect, it } from 'vitest'
import {
  encodeKeywordPath,
  hostOf,
  joinUrl,
  normalizeBaseUrl,
  originOf,
  originPattern,
  shortHostPattern,
} from './url'

describe('normalizeBaseUrl', () => {
  it('keeps a plain origin', () => {
    expect(normalizeBaseUrl('https://links.example.com')).toBe('https://links.example.com')
  })

  it('drops a trailing slash', () => {
    expect(normalizeBaseUrl('https://links.example.com/')).toBe('https://links.example.com')
  })

  it('assumes https when no scheme is typed', () => {
    expect(normalizeBaseUrl('links.example.com')).toBe('https://links.example.com')
  })

  it('keeps an explicit port', () => {
    expect(normalizeBaseUrl('http://localhost:3999/')).toBe('http://localhost:3999')
  })

  it('keeps a path prefix', () => {
    expect(normalizeBaseUrl('https://example.com/links/')).toBe('https://example.com/links')
  })

  it('trims surrounding space', () => {
    expect(normalizeBaseUrl('  https://links.example.com  ')).toBe('https://links.example.com')
  })

  it('rejects empty and non-http input', () => {
    expect(normalizeBaseUrl('')).toBeNull()
    expect(normalizeBaseUrl('   ')).toBeNull()
    expect(normalizeBaseUrl('ftp://files.example.com')).toBeNull()
    expect(normalizeBaseUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeBaseUrl('https://')).toBeNull()
  })
})

describe('origin helpers', () => {
  it('reads the origin of a base URL with a path prefix', () => {
    expect(originOf('https://example.com/links')).toBe('https://example.com')
  })

  it('builds the permission patterns', () => {
    expect(originPattern('https://example.com/links')).toBe('https://example.com/*')
    expect(shortHostPattern('go')).toBe('http://go/*')
  })

  it('reads a host with its port', () => {
    expect(hostOf('http://localhost:3999/handbook')).toBe('localhost:3999')
  })

  it('falls back to the raw text when a URL will not parse', () => {
    expect(hostOf('not a url')).toBe('not a url')
  })
})

describe('joinUrl', () => {
  it('joins without doubling slashes', () => {
    expect(joinUrl('https://example.com/', '/handbook')).toBe('https://example.com/handbook')
  })

  it('appends parameters with ?', () => {
    expect(joinUrl('https://example.com', 'handbook', { via: 'ext' })).toBe(
      'https://example.com/handbook?via=ext',
    )
  })

  it('appends parameters with & when the path already carries a query', () => {
    expect(joinUrl('https://example.com', 'handbook?page=2', { via: 'ext' })).toBe(
      'https://example.com/handbook?page=2&via=ext',
    )
  })

  it('produces the directory URL for an empty path', () => {
    expect(joinUrl('https://example.com', '')).toBe('https://example.com/')
  })

  it('escapes parameter values', () => {
    expect(joinUrl('https://example.com', '_/api/v1/links', { destination: 'a b&c' })).toBe(
      'https://example.com/_/api/v1/links?destination=a+b%26c',
    )
  })
})

describe('encodeKeywordPath', () => {
  it('leaves segment separators alone', () => {
    expect(encodeKeywordPath('eng/on-call')).toBe('eng/on-call')
  })

  it('escapes characters inside a segment', () => {
    expect(encodeKeywordPath('team notes')).toBe('team%20notes')
    expect(encodeKeywordPath('a?b')).toBe('a%3Fb')
  })
})
