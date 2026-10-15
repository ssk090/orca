import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClickUpClientForWorkspace } from './client'

const { clickUpRequestMock, getClientsMock } = vi.hoisted(() => ({
  clickUpRequestMock: vi.fn(),
  getClientsMock: vi.fn()
}))

vi.mock('./client', () => ({
  clickUpRequest: (...args: unknown[]) => clickUpRequestMock(...args),
  onClickUpDisconnect: vi.fn(),
  requireClickUpClient: (workspaceId?: string) => getClientsMock(workspaceId)[0],
  requireClickUpClients: (workspaceId?: string) => getClientsMock(workspaceId)
}))

function client(id = 'team-1'): ClickUpClientForWorkspace {
  return { workspace: { id, name: `Workspace ${id}` }, token: 'pk_token' }
}

function mockHierarchy(): void {
  clickUpRequestMock.mockImplementation(async (_client: unknown, path: string) => {
    if (path.startsWith('/team/')) {
      return { spaces: [{ id: 'space-1', name: 'Engineering' }] }
    }
    if (path.startsWith('/space/space-1/folder')) {
      return {
        folders: [
          {
            id: 'folder-1',
            name: 'Product',
            lists: [
              { id: 'list-2', name: 'Backlog', statuses: [{ status: 'open', type: 'open' }] },
              { id: 'list-3', name: 'Old', archived: true }
            ]
          },
          { id: 'folder-2', name: 'Archived', archived: true, lists: [{ id: 'x', name: 'X' }] }
        ]
      }
    }
    if (path.startsWith('/space/space-1/list')) {
      return { lists: [{ id: 'list-1', name: 'Inbox' }] }
    }
    if (path.startsWith('/list/list-9')) {
      return { id: 'list-9', name: 'Solo', space: { id: 'space-1', name: 'Engineering' } }
    }
    throw new Error(`unexpected ${path}`)
  })
}

describe('ClickUp List hierarchy', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    getClientsMock.mockReturnValue([client()])
    const { clearClickUpListCache } = await import('./workspace-directory')
    clearClickUpListCache()
    mockHierarchy()
  })

  it('reads Folder Lists inline instead of one request per Folder', async () => {
    const { listClickUpLists } = await import('./workspace-directory')

    await expect(listClickUpLists('team-1')).resolves.toMatchObject([
      { id: 'list-1', space: { name: 'Engineering' }, name: 'Inbox' },
      {
        id: 'list-2',
        space: { name: 'Engineering' },
        folder: { name: 'Product' },
        name: 'Backlog',
        statuses: [{ name: 'open' }]
      }
    ])
    // Spaces, plus one Folder and one folderless call per Space; archived Lists drop out.
    expect(clickUpRequestMock).toHaveBeenCalledTimes(3)
    expect(clickUpRequestMock.mock.calls.map((call) => call[1])).not.toContain(
      expect.stringContaining('/folder/')
    )
  })

  it('serves repeat and concurrent loads from one cached walk', async () => {
    const { listClickUpLists } = await import('./workspace-directory')

    await Promise.all([listClickUpLists('team-1'), listClickUpLists('team-1')])
    await listClickUpLists('team-1')

    expect(clickUpRequestMock).toHaveBeenCalledTimes(3)
  })

  it('reads a single List with one request when listId is given', async () => {
    const { listClickUpLists } = await import('./workspace-directory')

    await expect(listClickUpLists('team-1', 'list-9')).resolves.toMatchObject([
      { id: 'list-9', name: 'Solo' }
    ])
    expect(clickUpRequestMock).toHaveBeenCalledTimes(1)
  })

  it('refetches after a failed walk instead of caching the failure', async () => {
    clickUpRequestMock.mockRejectedValueOnce(new Error('Rate limit reached'))
    const { listClickUpLists } = await import('./workspace-directory')

    await expect(listClickUpLists('team-1')).rejects.toThrow('Rate limit reached')
    mockHierarchy()
    await expect(listClickUpLists('team-1')).resolves.toHaveLength(2)
  })
})
