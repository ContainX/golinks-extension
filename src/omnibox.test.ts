import { describe, expect, it } from 'vitest'
import type { Link } from './api'
import {
  formatSuggestion,
  navigationUrl,
  parseOmniboxInput,
  suggestionDescription,
} from './omnibox'

const link = (over: Partial<Link>): Link => ({
  id: '1',
  fullPath: 'go/handbook',
  displayKeyword: 'handbook',
  namespace: 'go',
  destination: 'https://docs.example.com/handbook',
  ...over,
})

describe('parseOmniboxInput', () => {
  it('trims surrounding space', () => {
    expect(parseOmniboxInput('  handbook  ', 'go')).toBe('handbook')
  })

  it('drops a go/ prefix typed out of habit', () => {
    expect(parseOmniboxInput('go/handbook', 'go')).toBe('handbook')
    expect(parseOmniboxInput('GO/handbook', 'go')).toBe('handbook')
  })

  it('drops the configured short host prefix', () => {
    expect(parseOmniboxInput('links/handbook', 'links')).toBe('handbook')
    expect(parseOmniboxInput('go/handbook', 'links')).toBe('handbook')
  })

  it('drops a repeated prefix', () => {
    expect(parseOmniboxInput('go/go/handbook', 'go')).toBe('handbook')
  })

  it('drops leading slashes', () => {
    expect(parseOmniboxInput('/handbook', 'go')).toBe('handbook')
  })

  it('keeps a namespaced keyword path intact', () => {
    expect(parseOmniboxInput('eng/on-call', 'go')).toBe('eng/on-call')
  })

  it('keeps placeholder values intact', () => {
    expect(parseOmniboxInput('ticket/ABC-123', 'go')).toBe('ticket/ABC-123')
  })

  it('passes text with spaces through as typed', () => {
    expect(parseOmniboxInput('meeting notes', 'go')).toBe('meeting notes')
  })

  it('returns empty for empty input', () => {
    expect(parseOmniboxInput('', 'go')).toBe('')
    expect(parseOmniboxInput('   ', 'go')).toBe('')
    expect(parseOmniboxInput('go/', 'go')).toBe('')
  })
})

describe('navigationUrl', () => {
  const base = 'https://links.example.com'

  it('goes through the resolver and records the source', () => {
    expect(navigationUrl(base, 'handbook', 'go')).toBe('https://links.example.com/handbook?via=ext')
  })

  it('opens the directory on empty input', () => {
    expect(navigationUrl(base, '   ', 'go')).toBe('https://links.example.com/')
  })

  it('keeps the separators of a keyword path', () => {
    expect(navigationUrl(base, 'eng/on-call', 'go')).toBe(
      'https://links.example.com/eng/on-call?via=ext',
    )
  })

  it('escapes what cannot go in a path segment', () => {
    expect(navigationUrl(base, 'meeting notes', 'go')).toBe(
      'https://links.example.com/meeting%20notes?via=ext',
    )
  })

  it('respects a base URL path prefix', () => {
    expect(navigationUrl('https://example.com/links', 'handbook', 'go')).toBe(
      'https://example.com/links/handbook?via=ext',
    )
  })
})

describe('suggestions', () => {
  it('shows the short form and the destination host', () => {
    expect(formatSuggestion(link({}), 'go')).toBe('go/handbook — docs.example.com')
  })

  it('falls back to the short host when the link has no full path', () => {
    expect(formatSuggestion(link({ fullPath: '', displayKeyword: 'on-call' }), 'links')).toBe(
      'links/on-call — docs.example.com',
    )
  })

  it('escapes the XML Chrome renders', () => {
    expect(
      suggestionDescription(link({ fullPath: 'go/a&b', destination: 'https://x.test/' }), 'go'),
    ).toBe('<match>go/a&amp;b</match> <dim>—</dim> <url>x.test</url>')
  })
})
