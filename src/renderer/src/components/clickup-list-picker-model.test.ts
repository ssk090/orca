import { describe, expect, it } from 'vitest'
import type { ClickUpList } from '../../../shared/clickup-types'
import {
  clickUpSelectedListName,
  filterClickUpPickerSprints,
  groupClickUpPickerLists,
  matchesClickUpPickerQuery,
  resolveClickUpListSelection
} from './clickup-list-picker-model'
import {
  detectClickUpSprints,
  findCurrentClickUpSprint,
  groupClickUpSprintFolders,
  pickDefaultClickUpSprintFolder
} from './clickup-sprints'

const now = new Date('2026-10-15T12:00:00.000Z')

function list(
  id: string,
  name: string,
  folder: { id: string; name: string } | undefined,
  extra: Partial<ClickUpList> = {}
): ClickUpList {
  return { id, workspaceId: '8651091', name, statuses: [], folder, ...extra }
}

function sprint(
  id: string,
  name: string,
  folder: { id: string; name: string },
  start: string,
  due: string,
  taskCount: number
): ClickUpList {
  return list(id, name, folder, {
    startDate: `${start}T00:00:00.000Z`,
    dueDate: `${due}T00:00:00.000Z`,
    taskCount
  })
}

// Shaped like the live Chip1 hierarchy (ids, names, dates and task counts).
const q3 = { id: '901410378931', name: 'Weekly Sprints - Q3 2026' }
const weekly = { id: '90142051634', name: 'Weekly Sprints' }
const dev = { id: '90142465092', name: 'Dev Sprints' }
const qe = { id: '90149725264', name: 'QE Sprint Folder' }
const voc = { id: '90141832819', name: 'Voice of Customer' }
const chip1: ClickUpList[] = [
  list('901418328197', 'Voice of Customer', voc, { taskCount: 174 }),
  sprint('901421093583', 'Sprint 13 (9/22 - 9/28)', q3, '2026-09-21', '2026-09-28', 10),
  sprint('901421351728', 'Sprint 14 (9/29 - 10/5)', q3, '2026-09-28', '2026-10-05', 3),
  sprint('901421622270', 'Sprint 15 (10/6 - 10/12)', q3, '2026-10-05', '2026-10-12', 4),
  sprint('901421931549', 'Sprint 16 (10/13 - 10/19)', q3, '2026-10-12', '2026-10-19', 66),
  sprint('901422195408', 'Sprint 17 (10/20 - 10/26)', q3, '2026-10-19', '2026-10-26', 0),
  sprint('901421931485', 'Sprint 126 (10/13 - 10/19)', weekly, '2026-10-12', '2026-10-19', 8),
  sprint('901421093560', 'Sprint 61 (10/13 - 10/26)', dev, '2026-10-12', '2026-10-26', 156),
  list('901416851249', 'QE Backlog Tasks', qe, { taskCount: 1 }),
  sprint('901416851170', 'Sprint 1 (6/1 - 6/14)', qe, '2026-05-31', '2026-06-14', 16),
  list('901400000001', 'MC1 Bugs & Feedback', undefined, { taskCount: 12 })
]

describe('ClickUp sprint folders', () => {
  it('defaults Chip1 to its newest active Folder, not the one with the most tasks', () => {
    const folders = groupClickUpSprintFolders(detectClickUpSprints(chip1, now))
    expect(folders.map((folder) => folder.name)).toEqual([
      'QE Sprint Folder',
      'Weekly Sprints - Q3 2026',
      'Weekly Sprints',
      'Dev Sprints'
    ])
    const picked = pickDefaultClickUpSprintFolder(folders, now)
    expect(picked?.name).toBe('Weekly Sprints - Q3 2026')
    expect(picked?.sprints.map((item) => item.name)).toEqual([
      'Sprint 13 (9/22 - 9/28)',
      'Sprint 14 (9/29 - 10/5)',
      'Sprint 15 (10/6 - 10/12)',
      'Sprint 16 (10/13 - 10/19)',
      'Sprint 17 (10/20 - 10/26)'
    ])
    const current = findCurrentClickUpSprint(picked?.sprints ?? [], now)
    expect(current).toMatchObject({ name: 'Sprint 16 (10/13 - 10/19)', taskCount: 66 })
  })

  it('falls back to the newest Folder when no Sprint covers today', () => {
    const folders = groupClickUpSprintFolders(
      detectClickUpSprints(chip1, new Date('2027-03-01T00:00:00.000Z'))
    )
    expect(pickDefaultClickUpSprintFolder(folders, new Date('2027-03-01'))?.id).toBe(q3.id)
    expect(pickDefaultClickUpSprintFolder([], now)).toBeNull()
  })
})

describe('ClickUp Sprint / List picker model', () => {
  it('groups non-sprint Lists by Folder with Folderless Lists last', () => {
    expect(
      groupClickUpPickerLists(chip1, '').map((group) => [
        group.folderName,
        group.lists.map((item) => item.name)
      ])
    ).toEqual([
      ['Voice of Customer', ['Voice of Customer']],
      ['QE Sprint Folder', ['QE Backlog Tasks']],
      [null, ['MC1 Bugs & Feedback']]
    ])
  })

  it('filters Lists by List or Folder name and Sprints by name as you type', () => {
    expect(groupClickUpPickerLists(chip1, 'voice cust')[0]?.lists[0]?.id).toBe('901418328197')
    expect(groupClickUpPickerLists(chip1, 'qe sprint')[0]?.lists.map((l) => l.name)).toEqual([
      'QE Backlog Tasks'
    ])
    expect(groupClickUpPickerLists(chip1, 'nothing here')).toEqual([])
    const folder = pickDefaultClickUpSprintFolder(
      groupClickUpSprintFolders(detectClickUpSprints(chip1, now)),
      now
    )
    expect(filterClickUpPickerSprints(folder?.sprints ?? [], '16').map((s) => s.listId)).toEqual([
      '901421931549'
    ])
    expect(matchesClickUpPickerQuery('Voice of Customer', '  ')).toBe(true)
  })

  it('resolves the selection to one list_ids[] entry', () => {
    const current = findCurrentClickUpSprint(detectClickUpSprints(chip1, now), now)
    expect(resolveClickUpListSelection('all', chip1, current)).toBeNull()
    expect(resolveClickUpListSelection('current', chip1, null)).toBeNull()
    expect(resolveClickUpListSelection({ listId: '901418328197' }, chip1, current)).toBe(
      '901418328197'
    )
    // A saved List that left the Space must not leave the page empty.
    expect(resolveClickUpListSelection({ listId: 'gone' }, chip1, current)).toBeNull()
    expect(clickUpSelectedListName({ listId: '901418328197' }, chip1)).toBe('Voice of Customer')
    expect(clickUpSelectedListName('current', chip1)).toBeNull()
  })
})
