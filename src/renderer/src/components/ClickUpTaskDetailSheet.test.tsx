// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClickUpTask } from '../../../shared/clickup-types'
import { ClickUpTaskDetailSheet } from './ClickUpTaskDetailSheet'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  patch: vi.fn(),
  refresh: vi.fn()
}))
vi.mock('@/runtime/runtime-clickup-client', () => ({
  clickUpUpdateTask: mocks.update,
  clickUpListLists: vi.fn().mockResolvedValue([]),
  clickUpTaskComments: vi.fn().mockResolvedValue([]),
  clickUpAddTaskComment: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ patchClickUpTask: mocks.patch, fetchClickUpTask: mocks.refresh })
}))

const task: ClickUpTask = {
  id: 'abc',
  workspaceId: 'team-1',
  name: 'Original name',
  description: 'Plain text from search',
  url: 'https://app.clickup.com/t/abc',
  status: { name: 'Open', color: '', type: 'custom', orderIndex: 0 },
  priority: null,
  dueDate: '2026-10-22T18:30:00.000Z',
  assignees: [],
  tags: [],
  list: { id: 'list-1', name: 'Backlog' },
  createdAt: '',
  updatedAt: ''
}

function openSheet() {
  render(
    <ClickUpTaskDetailSheet
      task={task}
      sourceContext={null}
      onClose={vi.fn()}
      onStartWorkspace={vi.fn()}
      onTaskChanged={vi.fn()}
    />
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.update.mockResolvedValue({ ok: true })
  mocks.refresh.mockResolvedValue(null)
})

describe('ClickUp task saves', () => {
  it('preserves server Markdown and due time when only the name changes', async () => {
    openSheet()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('abc', { name: 'Renamed' }, null))
    expect(mocks.update).toHaveBeenCalledWith(null, 'abc', { name: 'Renamed' }, 'team-1')
  })

  it('does not write an unchanged task', () => {
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('sends explicit clears for changed fields', async () => {
    openSheet()
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        null,
        'abc',
        { description: '', dueDate: null },
        'team-1'
      )
    )
  })

  it('does not patch caches after a rejected write', async () => {
    mocks.update.mockResolvedValue({ ok: false, error: 'Rejected' })
    openSheet()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Rejected')
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('keeps edits typed while a save is pending', async () => {
    const refreshed: ClickUpTask = { ...task, name: 'Renamed', updatedAt: '1' }
    let resolveRefresh: (value: ClickUpTask) => void = () => {}
    mocks.refresh.mockImplementation(
      () =>
        new Promise<ClickUpTask>((resolve) => {
          resolveRefresh = resolve
        })
    )
    const onTaskChanged = vi.fn()
    render(
      <ClickUpTaskDetailSheet
        task={task}
        sourceContext={null}
        onClose={vi.fn()}
        onStartWorkspace={vi.fn()}
        onTaskChanged={onTaskChanged}
      />
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Renamed while saving' }
    })
    resolveRefresh(refreshed)
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('abc', refreshed, null))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Renamed while saving')
    expect(onTaskChanged).not.toHaveBeenCalled()
  })

  it('patches caches but does not reopen the sheet after a late save', async () => {
    const refreshed: ClickUpTask = { ...task, name: 'Renamed', updatedAt: '1' }
    let resolveRefresh: (value: ClickUpTask) => void = () => {}
    mocks.refresh.mockImplementation(
      () =>
        new Promise<ClickUpTask>((resolve) => {
          resolveRefresh = resolve
        })
    )
    const onTaskChanged = vi.fn()
    const props: ComponentProps<typeof ClickUpTaskDetailSheet> = {
      task,
      sourceContext: null,
      onClose: vi.fn(),
      onStartWorkspace: vi.fn(),
      onTaskChanged
    }
    const view = render(<ClickUpTaskDetailSheet {...props} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    view.rerender(<ClickUpTaskDetailSheet {...props} task={null} />)
    resolveRefresh(refreshed)
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('abc', refreshed, null))
    expect(onTaskChanged).not.toHaveBeenCalled()
  })
})
