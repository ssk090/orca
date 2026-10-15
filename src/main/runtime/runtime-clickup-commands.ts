import type {
  ClickUpCreateTaskArgs,
  ClickUpTaskFilter,
  ClickUpTaskUpdate,
  ClickUpWorkspaceSelection
} from '../../shared/clickup-types'
import { connect, disconnect, getStatus, selectWorkspace, testConnection } from '../clickup/client'
import {
  addTaskComment,
  createTask,
  getTask,
  getTaskComments,
  listLists,
  listTasks,
  listWorkspaceMembers,
  listWorkspaceTags,
  searchTasks,
  updateTask
} from '../clickup/tasks'

function clampLimit(limit: number): number {
  return Math.min(Math.max(1, limit), 100)
}

// Why: mirrors RuntimeJiraCommands so the edge controller can bind every
// `clickUp*` method onto the runtime surface without touching the core class.
export class RuntimeClickUpCommands {
  clickUpConnect(apiToken: string): ReturnType<typeof connect> {
    return connect(apiToken)
  }

  clickUpDisconnect(): { ok: true } {
    disconnect()
    return { ok: true }
  }

  clickUpSelectWorkspace(workspaceId: ClickUpWorkspaceSelection): ReturnType<typeof getStatus> {
    return selectWorkspace(workspaceId)
  }

  clickUpStatus(): ReturnType<typeof getStatus> {
    return getStatus()
  }

  clickUpTestConnection(): ReturnType<typeof testConnection> {
    return testConnection()
  }

  clickUpSearchTasks(
    query: string,
    limit = 20,
    workspaceId?: ClickUpWorkspaceSelection
  ): ReturnType<typeof searchTasks> {
    return searchTasks(query, clampLimit(limit), workspaceId)
  }

  clickUpListTasks(
    filter?: ClickUpTaskFilter,
    limit = 50,
    workspaceId?: ClickUpWorkspaceSelection
  ): ReturnType<typeof listTasks> {
    return listTasks(filter, clampLimit(limit), workspaceId)
  }

  clickUpGetTask(taskId: string, workspaceId?: string): ReturnType<typeof getTask> {
    return getTask(taskId, workspaceId)
  }

  clickUpCreateTask(args: ClickUpCreateTaskArgs): ReturnType<typeof createTask> {
    return createTask(args)
  }

  clickUpUpdateTask(
    taskId: string,
    updates: ClickUpTaskUpdate,
    workspaceId?: string
  ): ReturnType<typeof updateTask> {
    return updateTask(taskId, updates, workspaceId)
  }

  clickUpAddTaskComment(
    taskId: string,
    body: string,
    workspaceId?: string
  ): ReturnType<typeof addTaskComment> {
    return addTaskComment(taskId, body, workspaceId)
  }

  clickUpTaskComments(taskId: string, workspaceId?: string): ReturnType<typeof getTaskComments> {
    return getTaskComments(taskId, workspaceId)
  }

  clickUpListLists(
    workspaceId?: ClickUpWorkspaceSelection,
    listId?: string
  ): ReturnType<typeof listLists> {
    return listLists(workspaceId, listId)
  }

  clickUpListMembers(workspaceId?: string): ReturnType<typeof listWorkspaceMembers> {
    return listWorkspaceMembers(workspaceId)
  }

  clickUpListTags(workspaceId?: string): ReturnType<typeof listWorkspaceTags> {
    return listWorkspaceTags(workspaceId)
  }
}
