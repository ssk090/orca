import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const clickUpApi = {
  connect: (args) => ipcRenderer.invoke('clickup:connect', args),

  disconnect: () => ipcRenderer.invoke('clickup:disconnect'),

  selectWorkspace: (args) => ipcRenderer.invoke('clickup:selectWorkspace', args),

  status: () => ipcRenderer.invoke('clickup:status'),

  testConnection: () => ipcRenderer.invoke('clickup:testConnection'),

  searchTasks: (args) => ipcRenderer.invoke('clickup:searchTasks', args),

  listTasks: (args) => ipcRenderer.invoke('clickup:listTasks', args),

  getTask: (args) => ipcRenderer.invoke('clickup:getTask', args),

  createTask: (args) => ipcRenderer.invoke('clickup:createTask', args),

  updateTask: (args) => ipcRenderer.invoke('clickup:updateTask', args),

  addTaskComment: (args) => ipcRenderer.invoke('clickup:addTaskComment', args),

  taskComments: (args) => ipcRenderer.invoke('clickup:taskComments', args),

  listLists: (args) => ipcRenderer.invoke('clickup:listLists', args),

  listMembers: (args) => ipcRenderer.invoke('clickup:listMembers', args),

  listTags: (args) => ipcRenderer.invoke('clickup:listTags', args)
} satisfies PreloadApi['clickup']
