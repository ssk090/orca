import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type {
  ClickUpConnectionStatus,
  ClickUpTask,
  ClickUpTaskFilter,
  ClickUpViewer,
  ClickUpWorkspaceSelection
} from '../../../../shared/clickup-types'
import type { CacheEntry } from '../github/cache-model'
import {
  clickUpConnect,
  clickUpDisconnect,
  clickUpGetTask,
  clickUpListTasks,
  clickUpSearchTasks,
  clickUpSelectWorkspace,
  clickUpStatus,
  clickUpTestConnection
} from '@/runtime/runtime-clickup-client'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { patchClickUpCaches } from './clickup-task-cache-patch'
import {
  getReadScope,
  scopedKey,
  selectedWorkspaceId,
  taskScopeKey,
  type ClickUpReadOptions
} from './clickup-read-scope'
import {
  evictStaleClickUpCacheEntries,
  isFreshClickUpCacheEntry
} from './clickup-task-cache-policy'

let mutationGeneration = 0
const statusInflight = new Map<string, Promise<void>>()
const taskInflight = new Map<string, Promise<ClickUpTask | null>>()

export type ClickUpSlice = {
  clickUpStatus: ClickUpConnectionStatus
  clickUpStatusChecked: boolean
  clickUpStatusContextKey: string | null
  clickUpTaskCache: Record<string, CacheEntry<ClickUpTask>>
  clickUpSearchCache: Record<string, CacheEntry<ClickUpTask[]>>
  clickUpListCache: Record<string, CacheEntry<ClickUpTask[]>>

  checkClickUpConnection: (force?: boolean) => Promise<void>
  connectClickUp: (
    apiToken: string
  ) => Promise<{ ok: true; viewer: ClickUpViewer } | { ok: false; error: string }>
  testClickUpConnection: () => Promise<
    { ok: true; viewer: ClickUpViewer } | { ok: false; error: string }
  >
  disconnectClickUp: () => Promise<void>
  selectClickUpWorkspace: (workspaceId: ClickUpWorkspaceSelection) => Promise<void>
  fetchClickUpTask: (
    taskId: string,
    workspaceId?: string | null,
    options?: ClickUpReadOptions
  ) => Promise<ClickUpTask | null>
  searchClickUpTasks: (
    query: string,
    limit?: number,
    options?: ClickUpReadOptions
  ) => Promise<ClickUpTask[]>
  listClickUpTasks: (
    filter?: ClickUpTaskFilter,
    limit?: number,
    options?: ClickUpReadOptions
  ) => Promise<ClickUpTask[]>
  patchClickUpTask: (
    taskId: string,
    patch: Partial<ClickUpTask>,
    sourceContext?: TaskSourceContext | null
  ) => void
}

export const createClickUpSlice: StateCreator<AppState, [], [], ClickUpSlice> = (set, get) => ({
  clickUpStatus: { connected: false, viewer: null },
  clickUpStatusChecked: false,
  clickUpStatusContextKey: null,
  clickUpTaskCache: {},
  clickUpSearchCache: {},
  clickUpListCache: {},

  checkClickUpConnection: async (force = false) => {
    const contextKey = getProviderRuntimeContextKey(get().settings)
    const key = `status::${contextKey}`
    const existing = statusInflight.get(key)
    if (existing && !force) {
      return existing
    }
    const generation = mutationGeneration
    const request = clickUpStatus(get().settings)
      .then((status) => {
        if (
          generation !== mutationGeneration ||
          contextKey !== getProviderRuntimeContextKey(get().settings)
        ) {
          return
        }
        const previous = get().clickUpStatus
        const scopeChanged =
          previous.connected !== status.connected ||
          selectedWorkspaceId(previous) !== selectedWorkspaceId(status) ||
          previous.viewer?.id !== status.viewer?.id
        set({
          clickUpStatus: status,
          clickUpStatusChecked: true,
          clickUpStatusContextKey: contextKey,
          ...(scopeChanged
            ? { clickUpTaskCache: {}, clickUpSearchCache: {}, clickUpListCache: {} }
            : {})
        })
      })
      .catch(() => {
        if (
          generation === mutationGeneration &&
          contextKey === getProviderRuntimeContextKey(get().settings)
        ) {
          set({
            clickUpStatus: { connected: false, viewer: null },
            clickUpStatusChecked: true,
            clickUpStatusContextKey: contextKey
          })
        }
      })
      .finally(() => {
        if (statusInflight.get(key) === request) {
          statusInflight.delete(key)
        }
      })
    statusInflight.set(key, request)
    return request
  },

  connectClickUp: async (apiToken) => {
    mutationGeneration += 1
    const result = await clickUpConnect(get().settings, apiToken)
    if (result.ok) {
      const status = await clickUpStatus(get().settings)
      set({
        clickUpStatus: status,
        clickUpStatusChecked: true,
        clickUpStatusContextKey: getProviderRuntimeContextKey(get().settings),
        clickUpTaskCache: {},
        clickUpSearchCache: {},
        clickUpListCache: {}
      })
    }
    return result
  },

  testClickUpConnection: async () => clickUpTestConnection(get().settings),

  disconnectClickUp: async () => {
    mutationGeneration += 1
    await clickUpDisconnect(get().settings)
    set({
      clickUpStatus: { connected: false, viewer: null },
      clickUpStatusChecked: true,
      clickUpStatusContextKey: getProviderRuntimeContextKey(get().settings),
      clickUpTaskCache: {},
      clickUpSearchCache: {},
      clickUpListCache: {}
    })
  },

  selectClickUpWorkspace: async (workspaceId) => {
    mutationGeneration += 1
    const status = await clickUpSelectWorkspace(get().settings, workspaceId)
    set({
      clickUpStatus: status,
      clickUpStatusChecked: true,
      clickUpStatusContextKey: getProviderRuntimeContextKey(get().settings),
      clickUpTaskCache: {},
      clickUpSearchCache: {},
      clickUpListCache: {}
    })
  },

  fetchClickUpTask: async (taskId, workspaceId, options) => {
    const scope = getReadScope(get().settings, options?.sourceContext)
    const key = scopedKey(scope, `${workspaceId ?? 'default'}::task::${taskId}`)
    const cached = get().clickUpTaskCache[key]
    if (!options?.force && isFreshClickUpCacheEntry(cached)) {
      return cached.data
    }
    const existing = taskInflight.get(key)
    if (existing && !options?.force) {
      return existing
    }
    const generation = mutationGeneration
    const request = clickUpGetTask(scope.settings, taskId, workspaceId)
      .then((task) => {
        if (
          generation === mutationGeneration &&
          (scope.explicitSource ||
            scope.contextKey === getProviderRuntimeContextKey(get().settings))
        ) {
          set((state) => ({
            clickUpTaskCache: evictStaleClickUpCacheEntries({
              ...state.clickUpTaskCache,
              [key]: { data: task, fetchedAt: Date.now() }
            })
          }))
        }
        return task
      })
      .finally(() => {
        if (taskInflight.get(key) === request) {
          taskInflight.delete(key)
        }
      })
    taskInflight.set(key, request)
    return request
  },

  searchClickUpTasks: async (query, limit = 20, options) => {
    const scope = getReadScope(get().settings, options?.sourceContext)
    const workspaceId = selectedWorkspaceId(get().clickUpStatus)
    const key = scopedKey(
      scope,
      `${workspaceId ?? 'default'}::search::${query}::${limit}::${taskScopeKey(options?.taskScope)}`
    )
    const cached = get().clickUpSearchCache[key]
    if (!options?.force && isFreshClickUpCacheEntry(cached)) {
      return cached.data ?? []
    }
    const generation = mutationGeneration
    const tasks = await clickUpSearchTasks(
      scope.settings,
      query,
      limit,
      workspaceId,
      options?.taskScope
    )
    if (generation !== mutationGeneration) {
      return tasks
    }
    set((state) => ({
      clickUpSearchCache: evictStaleClickUpCacheEntries({
        ...state.clickUpSearchCache,
        [key]: { data: tasks, fetchedAt: Date.now() }
      }),
      clickUpTaskCache: tasks.reduce(
        (cache, task) => ({
          ...cache,
          [scopedKey(scope, `${task.workspaceId}::task::${task.id}`)]: {
            data: task,
            fetchedAt: Date.now()
          }
        }),
        state.clickUpTaskCache
      )
    }))
    return tasks
  },

  listClickUpTasks: async (filter = 'assigned', limit = 50, options) => {
    const scope = getReadScope(get().settings, options?.sourceContext)
    const workspaceId = selectedWorkspaceId(get().clickUpStatus)
    const key = scopedKey(
      scope,
      `${workspaceId ?? 'default'}::list::${filter}::${limit}::${taskScopeKey(options?.taskScope)}`
    )
    const cached = get().clickUpListCache[key]
    if (!options?.force && isFreshClickUpCacheEntry(cached)) {
      return cached.data ?? []
    }
    const generation = mutationGeneration
    const tasks = await clickUpListTasks(
      scope.settings,
      filter,
      limit,
      workspaceId,
      options?.taskScope
    )
    if (generation !== mutationGeneration) {
      return tasks
    }
    set((state) => ({
      clickUpListCache: evictStaleClickUpCacheEntries({
        ...state.clickUpListCache,
        [key]: { data: tasks, fetchedAt: Date.now() }
      })
    }))
    return tasks
  },

  patchClickUpTask: (taskId, patch, sourceContext) => {
    const scope = getReadScope(get().settings, sourceContext)
    set((state) => patchClickUpCaches(state, taskId, patch, scope.cachePrefix))
  }
})
