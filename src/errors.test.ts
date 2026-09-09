import { describe, expect, it } from 'vitest'
import type { ApiErrorEnvelope, ApiResult, Link } from './api'
import { parseErrorEnvelope, parseLink, parseLinkList } from './api'
import { presentError } from './errors'

const existing: Link = {
  id: '42',
  fullPath: 'go/handbook',
  displayKeyword: 'handbook',
  namespace: 'go',
  destination: 'https://docs.example.com/handbook',
}

const failure = (status: number, error: Partial<ApiErrorEnvelope>): ApiResult<never> => ({
  kind: 'error',
  status,
  error: { code: '', message: '', fields: {}, existingLink: null, ...error },
})

describe('presentError', () => {
  const base = 'https://links.example.com'

  it('names the host when the deployment is unreachable', () => {
    expect(presentError({ kind: 'unreachable' }, base)).toEqual({
      placement: 'form',
      message: "Can't reach links.example.com",
      existingLink: null,
    })
  })

  it('carries the existing link for keyword_exists', () => {
    const shown = presentError(
      failure(409, {
        code: 'keyword_exists',
        message: 'go/handbook already exists.',
        existingLink: existing,
      }),
      base,
    )
    expect(shown.placement).toBe('keyword')
    expect(shown.message).toBe('go/handbook already exists.')
    expect(shown.existingLink).toEqual(existing)
  })

  it('carries the existing link for keyword_conflict', () => {
    const shown = presentError(
      failure(409, { code: 'keyword_conflict', existingLink: existing }),
      base,
    )
    expect(shown.existingLink).toEqual(existing)
    expect(shown.message).toBe('That keyword conflicts with an existing link.')
  })

  it('puts keyword_invalid under the keyword field', () => {
    const shown = presentError(
      failure(400, { code: 'keyword_invalid', message: 'Use lowercase letters and dashes.' }),
      base,
    )
    expect(shown).toEqual({
      placement: 'keyword',
      message: 'Use lowercase letters and dashes.',
      existingLink: null,
    })
  })

  it('reads field messages out of validation_failed', () => {
    const shown = presentError(
      failure(400, {
        code: 'validation_failed',
        message: 'Validation failed.',
        fields: { keyword: 'Required.' },
      }),
      base,
    )
    expect(shown).toEqual({ placement: 'keyword', message: 'Required.', existingLink: null })
  })

  it('places a destination problem under the destination', () => {
    expect(presentError(failure(400, { code: 'destination_invalid' }), base).placement).toBe(
      'destination',
    )
  })

  it('shows anything else across the form', () => {
    expect(presentError(failure(403, { code: 'forbidden' }), base)).toEqual({
      placement: 'form',
      message: 'You do not have permission to do that.',
      existingLink: null,
    })
  })

  it('explains an origin the deployment does not know', () => {
    expect(presentError(failure(403, { code: 'csrf_origin_mismatch' }), base).message).toContain(
      'EXTENSION_ORIGINS',
    )
  })

  it('falls back for an unknown code with no message', () => {
    expect(presentError(failure(500, { code: 'teapot' }), base).message).toBe(
      'Something went wrong.',
    )
  })
})

describe('envelope parsing', () => {
  it('reads the fields the extension uses and ignores the rest', () => {
    expect(
      parseLink({
        id: '42',
        namespace: 'go',
        keyword: 'handbook',
        displayKeyword: 'handbook',
        fullPath: 'go/handbook',
        destination: 'https://docs.example.com/handbook',
        visitCount: 128,
        permissions: { canEdit: true },
      }),
    ).toEqual(existing)
  })

  it('rejects a body that is not a link', () => {
    expect(parseLink(null)).toBeNull()
    expect(parseLink({ fullPath: 'go/x' })).toBeNull()
  })

  it('reads the list envelope', () => {
    expect(parseLinkList({ items: [{ id: '1' }, 'nonsense'], nextCursor: 'abc' })).toEqual({
      items: [{ id: '1', fullPath: '', displayKeyword: '', namespace: '', destination: '' }],
      nextCursor: 'abc',
    })
  })

  it('tolerates a missing list envelope', () => {
    expect(parseLinkList(null)).toEqual({ items: [], nextCursor: null })
  })

  it('reads the error envelope', () => {
    expect(
      parseErrorEnvelope(
        {
          error: {
            code: 'validation_failed',
            message: 'Validation failed.',
            details: { fields: { destination: 'Must be a URL.', other: 7 } },
          },
        },
        400,
      ),
    ).toEqual({
      code: 'validation_failed',
      message: 'Validation failed.',
      fields: { destination: 'Must be a URL.' },
      existingLink: null,
    })
  })

  it('falls back when the body is not an envelope at all', () => {
    expect(parseErrorEnvelope('<html>502</html>', 502).code).toBe('internal_error')
  })
})
