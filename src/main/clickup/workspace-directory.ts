import type {
  ClickUpList,
  ClickUpTag,
  ClickUpUser,
  ClickUpWorkspaceSelection
} from '../../shared/clickup-types'
import {
  clickUpRequest,
  onClickUpDisconnect,
  requireClickUpClient,
  requireClickUpClients,
  type ClickUpClientForWorkspace
} from './client'
import {
  asRecord,
  asString,
  normalizeClickUpLocation,
  normalizeClickUpStatus,
  normalizeClickUpTag,
  normalizeClickUpUser
} from './task-mapping'

function normalizeList(
  value: unknown,
  client: ClickUpClientForWorkspace,
  fallbackSpace?: { id: string; name: string },
  fallbackFolder?: { id: string; name: string }
): ClickUpList | null {
  const record = asRecord(value)
  const id = asString(record?.id)
  const name = asString(record?.name)
  if (!record || !id || !name) {
    return null
  }
  return {
    id,
    workspaceId: client.workspace.id,
    workspaceName: client.workspace.name,
    name,
    url: asString(record.url),
    space: normalizeClickUpLocation(record.space) ?? fallbackSpace,
    folder: normalizeClickUpLocation(record.folder) ?? fallbackFolder,
    statuses: Array.isArray(record.statuses) ? record.statuses.map(normalizeClickUpStatus) : []
  }
}

// Why: the List hierarchy is only read by the create-task dialog and rarely
// changes, while walking it costs one request per Space; caching it per
// Workspace keeps reopening the dialog off ClickUp's per-minute budget.
const LIST_HIERARCHY_TTL_MS = 5 * 60_000
type CachedLists = { loadedAt: number; lists: ClickUpList[] }
const listHierarchyCache = new Map<string, CachedLists>()
const listHierarchyInFlight = new Map<string, Promise<ClickUpList[]>>()

function listCacheKey(client: ClickUpClientForWorkspace): string {
  // Why the token: reconnecting with another account must not reuse Lists the
  // previous token could see.
  return `${client.token}\u0000${client.workspace.id}`
}

function normalizeLists(
  values: unknown[] | undefined,
  client: ClickUpClientForWorkspace,
  space: { id: string; name: string },
  folder?: { id: string; name: string }
): ClickUpList[] {
  return (values ?? []).flatMap((value) => {
    if (asRecord(value)?.archived === true) {
      return []
    }
    const list = normalizeList(value, client, space, folder)
    return list ? [list] : []
  })
}

async function fetchListsForWorkspace(client: ClickUpClientForWorkspace): Promise<ClickUpList[]> {
  const spacesResponse = await clickUpRequest<{ spaces?: unknown[] }>(
    client,
    `/team/${encodeURIComponent(client.workspace.id)}/space?archived=false`
  )
  const spaces = (spacesResponse.spaces ?? []).flatMap((value) => {
    const space = normalizeClickUpLocation(value)
    return space ? [space] : []
  })
  // Why two calls per Space: GET /space/{id}/folder already embeds each Folder's
  // Lists, so only folderless Lists need their own request. Walking every Folder
  // separately cost a request per Folder and tripped 429 in large Workspaces.
  const lists = await Promise.all(
    spaces.map(async (space) => {
      const [folderResponse, folderlessResponse] = await Promise.all([
        clickUpRequest<{ folders?: unknown[] }>(
          client,
          `/space/${encodeURIComponent(space.id)}/folder?archived=false`
        ),
        clickUpRequest<{ lists?: unknown[] }>(
          client,
          `/space/${encodeURIComponent(space.id)}/list?archived=false`
        )
      ])
      const folderLists = (folderResponse.folders ?? []).flatMap((folderValue) => {
        const record = asRecord(folderValue)
        const folder = normalizeClickUpLocation(folderValue)
        if (!folder || record?.archived === true) {
          return []
        }
        return normalizeLists(
          Array.isArray(record?.lists) ? record.lists : [],
          client,
          space,
          folder
        )
      })
      return [...normalizeLists(folderlessResponse.lists, client, space), ...folderLists]
    })
  )
  return lists.flat()
}

async function listsForWorkspace(client: ClickUpClientForWorkspace): Promise<ClickUpList[]> {
  const key = listCacheKey(client)
  const cached = listHierarchyCache.get(key)
  if (cached && Date.now() - cached.loadedAt < LIST_HIERARCHY_TTL_MS) {
    return cached.lists
  }
  const inFlight = listHierarchyInFlight.get(key)
  if (inFlight) {
    return inFlight
  }
  const request = fetchListsForWorkspace(client)
    .then((lists) => {
      listHierarchyCache.set(key, { loadedAt: Date.now(), lists })
      return lists
    })
    .finally(() => listHierarchyInFlight.delete(key))
  listHierarchyInFlight.set(key, request)
  return request
}

export function clearClickUpListCache(): void {
  listHierarchyCache.clear()
}

onClickUpDisconnect(clearClickUpListCache)

async function getListForWorkspace(
  client: ClickUpClientForWorkspace,
  listId: string
): Promise<ClickUpList[]> {
  const cached = listHierarchyCache.get(listCacheKey(client))
  const hit = cached?.lists.find((list) => list.id === listId)
  if (hit && Date.now() - (cached?.loadedAt ?? 0) < LIST_HIERARCHY_TTL_MS) {
    return [hit]
  }
  const response = await clickUpRequest<unknown>(client, `/list/${encodeURIComponent(listId)}`)
  const list = normalizeList(response, client)
  return list ? [list] : []
}

// Lists the Workspace's Lists. With listId, reads just that List (one request)
// for callers that only need its statuses, such as the task detail sheet.
export async function listClickUpLists(
  workspaceId?: ClickUpWorkspaceSelection | null,
  listId?: string | null
): Promise<ClickUpList[]> {
  const clients = requireClickUpClients(workspaceId)
  const lists = await Promise.all(
    clients.map((client) =>
      listId ? getListForWorkspace(client, listId) : listsForWorkspace(client)
    )
  )
  return lists
    .flat()
    .sort((a, b) =>
      `${a.workspaceName ?? ''}\u0000${a.space?.name ?? ''}\u0000${a.folder?.name ?? ''}\u0000${a.name}`.localeCompare(
        `${b.workspaceName ?? ''}\u0000${b.space?.name ?? ''}\u0000${b.folder?.name ?? ''}\u0000${b.name}`
      )
    )
}

export async function listClickUpWorkspaceMembers(workspaceId?: string): Promise<ClickUpUser[]> {
  const client = requireClickUpClient(workspaceId)
  const response = await clickUpRequest<{ teams?: unknown[] }>(client, '/team')
  const workspace = (response.teams ?? [])
    .map(asRecord)
    .find((team) => asString(team?.id) === client.workspace.id)
  return (Array.isArray(workspace?.members) ? workspace.members : [])
    .map((member) => normalizeClickUpUser(asRecord(member)?.user ?? member))
    .filter((user): user is ClickUpUser => user !== null)
}

export async function listClickUpWorkspaceTags(workspaceId?: string): Promise<ClickUpTag[]> {
  const client = requireClickUpClient(workspaceId)
  const response = await clickUpRequest<{ tags?: unknown[] }>(
    client,
    `/team/${encodeURIComponent(client.workspace.id)}/tag`
  )
  return (response.tags ?? [])
    .map(normalizeClickUpTag)
    .filter((tag): tag is ClickUpTag => tag !== null)
}
