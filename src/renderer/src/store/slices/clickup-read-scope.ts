import type { AppState } from '../types'
import type {
  ClickUpConnectionStatus,
  ClickUpTaskScope,
  ClickUpWorkspaceSelection
} from '../../../../shared/clickup-types'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import {
  getTaskSourceCacheScope,
  getTaskSourceRuntimeSettings,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import { clickUpCacheKey } from './clickup-task-cache-policy'

export type ClickUpReadOptions = {
  force?: boolean
  sourceContext?: TaskSourceContext | null
  // Server-side Space/Sprint/Status narrowing for list and search reads.
  taskScope?: ClickUpTaskScope
}

export function taskScopeKey(taskScope?: ClickUpTaskScope): string {
  return taskScope
    ? JSON.stringify([
        taskScope.spaceId ?? '',
        [...(taskScope.listIds ?? [])].sort(),
        [...(taskScope.statuses ?? [])].sort()
      ])
    : ''
}

export type ClickUpReadScope = {
  settings: AppState['settings'] | TaskSourceContext | null
  contextKey: string
  cachePrefix: string | null
  explicitSource: boolean
}

export function getReadScope(
  settings: AppState['settings'],
  sourceContext?: TaskSourceContext | null
): ClickUpReadScope {
  if (!sourceContext) {
    return {
      settings,
      contextKey: getProviderRuntimeContextKey(settings),
      cachePrefix: null,
      explicitSource: false
    }
  }
  const runtimeSettings = getTaskSourceRuntimeSettings(sourceContext)
  return {
    settings: sourceContext,
    contextKey: `${getProviderRuntimeContextKey(runtimeSettings)}::${getTaskSourceCacheScope(sourceContext)}`,
    cachePrefix: getTaskSourceCacheScope(sourceContext),
    explicitSource: true
  }
}

export function scopedKey(scope: ClickUpReadScope, key: string): string {
  return clickUpCacheKey(scope.cachePrefix, key)
}

export function selectedWorkspaceId(
  status: ClickUpConnectionStatus
): ClickUpWorkspaceSelection | null {
  return status.selectedWorkspaceId ?? status.activeWorkspaceId ?? null
}
