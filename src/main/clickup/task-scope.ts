import type { ClickUpTaskScope } from '../../shared/clickup-types'
import { asRecord } from './json-record'

// Bounds what one request may carry so a hostile or buggy caller cannot build
// a URL ClickUp rejects for length.
const MAX_SCOPE_IDS = 50

export function normalizeClickUpTaskScope(value: unknown): ClickUpTaskScope | undefined {
  const record = asRecord(value)
  if (!record) {
    return undefined
  }
  const strings = (input: unknown): string[] | undefined => {
    if (!Array.isArray(input)) {
      return undefined
    }
    const items = input
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, MAX_SCOPE_IDS)
    return items.length > 0 ? items : undefined
  }
  const spaceId =
    typeof record.spaceId === 'string' && record.spaceId.trim() ? record.spaceId.trim() : undefined
  const listIds = strings(record.listIds)
  const statuses = strings(record.statuses)
  if (!spaceId && !listIds && !statuses) {
    return undefined
  }
  return {
    ...(spaceId ? { spaceId } : {}),
    ...(listIds ? { listIds } : {}),
    ...(statuses ? { statuses } : {})
  }
}

// Narrows GET /team/{id}/task on the server: space_ids[], list_ids[], statuses[].
export function appendClickUpTaskScope(query: URLSearchParams, scope?: ClickUpTaskScope): void {
  if (!scope) {
    return
  }
  if (scope.spaceId) {
    query.append('space_ids[]', scope.spaceId)
  }
  for (const listId of scope.listIds ?? []) {
    query.append('list_ids[]', listId)
  }
  if (scope.statuses && scope.statuses.length > 0) {
    for (const status of scope.statuses) {
      query.append('statuses[]', status)
    }
    // Why: ClickUp drops closed tasks unless asked, even when a closed status
    // is named explicitly; the statuses[] filter already bounds the result.
    query.set('include_closed', 'true')
  }
}

export function clickUpTaskScopeKey(scope?: ClickUpTaskScope): string {
  if (!scope) {
    return ''
  }
  return JSON.stringify([
    scope.spaceId ?? '',
    [...(scope.listIds ?? [])].sort(),
    [...(scope.statuses ?? [])].sort()
  ])
}
