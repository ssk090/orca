import { describe, expect, it } from 'vitest'
import {
  appendClickUpTaskScope,
  clickUpTaskScopeKey,
  normalizeClickUpTaskScope
} from './task-scope'

describe('ClickUp task scope', () => {
  it('drops empty or malformed scope input', () => {
    expect(normalizeClickUpTaskScope(undefined)).toBeUndefined()
    expect(normalizeClickUpTaskScope({ spaceId: ' ', listIds: [], statuses: [3] })).toBeUndefined()
    expect(
      normalizeClickUpTaskScope({ spaceId: ' 901 ', listIds: ['a', ''], statuses: ['to do'] })
    ).toEqual({ spaceId: '901', listIds: ['a'], statuses: ['to do'] })
  })

  it('narrows the team task query on the server', () => {
    const query = new URLSearchParams({ include_closed: 'false' })
    appendClickUpTaskScope(query, {
      spaceId: '901',
      listIds: ['sprint-12'],
      statuses: ['to do', 'on prod env']
    })
    expect(query.getAll('space_ids[]')).toEqual(['901'])
    expect(query.getAll('list_ids[]')).toEqual(['sprint-12'])
    expect(query.getAll('statuses[]')).toEqual(['to do', 'on prod env'])
    // Named statuses must reach closed tasks too.
    expect(query.get('include_closed')).toBe('true')
  })

  it('keys equivalent scopes the same regardless of order', () => {
    expect(clickUpTaskScopeKey({ spaceId: 's', statuses: ['b', 'a'] })).toBe(
      clickUpTaskScopeKey({ spaceId: 's', statuses: ['a', 'b'] })
    )
  })
})
