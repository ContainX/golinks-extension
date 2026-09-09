// Turning an API failure into something the popup can show.
//
// The service owns keyword rules, so the extension does not restate them: it
// shows the message the deployment sent and only decides where it belongs —
// under the keyword field, or across the form.

import type { ApiErrorEnvelope, ApiResult, Link } from './api'
import { hostOf } from './url'

export type ErrorPlacement = 'keyword' | 'destination' | 'form'

export interface ErrorPresentation {
  readonly placement: ErrorPlacement
  readonly message: string
  /** Present for `keyword_exists` and `keyword_conflict`. */
  readonly existingLink: Link | null
}

/** Codes that are the member's answer in the keyword field being wrong. */
const KEYWORD_CODES = new Set([
  'keyword_invalid',
  'keyword_reserved',
  'keyword_exists',
  'keyword_conflict',
  'namespace_invalid',
  'namespace_reserved',
  'placeholder_invalid',
  'placeholder_count_mismatch',
])

const FALLBACK_MESSAGES: Record<string, string> = {
  keyword_invalid: 'That keyword is not allowed here.',
  keyword_reserved: 'Keywords cannot start with an underscore.',
  keyword_exists: 'That keyword already exists.',
  keyword_conflict: 'That keyword conflicts with an existing link.',
  namespace_invalid: 'That namespace does not exist in this organization.',
  namespace_reserved: 'The first segment collides with a namespace.',
  placeholder_invalid: 'The placeholder is not in a position this keyword allows.',
  placeholder_count_mismatch:
    'The keyword and the destination use a different number of placeholders.',
  destination_invalid: 'That destination is not allowed.',
  validation_failed: 'Check the values and try again.',
  forbidden: 'You do not have permission to do that.',
  read_only: 'This organization is read-only right now.',
  csrf_origin_mismatch:
    'The deployment does not recognize this extension yet. An administrator has to add its id to EXTENSION_ORIGINS.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  internal_error: 'Something went wrong on the server.',
}

function messageFor(error: ApiErrorEnvelope): string {
  if (error.message !== '') return error.message
  return FALLBACK_MESSAGES[error.code] ?? 'Something went wrong.'
}

function placementFor(error: ApiErrorEnvelope): ErrorPlacement {
  if (KEYWORD_CODES.has(error.code)) return 'keyword'
  if (error.code === 'destination_invalid') return 'destination'
  if (error.code === 'validation_failed') {
    if ('keyword' in error.fields) return 'keyword'
    if ('destination' in error.fields) return 'destination'
  }
  return 'form'
}

/**
 * Describe a failed call. Callers handle `unauthenticated` themselves — the
 * popup switches to its signed-out view rather than showing a message — so it
 * is presented here only as a safety net.
 */
export function presentError(result: ApiResult<unknown>, baseUrl: string): ErrorPresentation {
  if (result.kind === 'unreachable') {
    return { placement: 'form', message: `Can't reach ${hostOf(baseUrl)}`, existingLink: null }
  }

  if (result.kind === 'unauthenticated') {
    return { placement: 'form', message: 'You are signed out.', existingLink: null }
  }

  if (result.kind === 'error') {
    const placement = placementFor(result.error)
    const fieldMessage = placement === 'form' ? undefined : result.error.fields[placement]
    return {
      placement,
      message: fieldMessage ?? messageFor(result.error),
      existingLink: result.error.existingLink,
    }
  }

  return { placement: 'form', message: '', existingLink: null }
}
