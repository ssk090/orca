import type { ClickUpList } from '../../../shared/clickup-types'

export type ClickUpSprint = {
  listId: string
  name: string
  folderName?: string
  // ISO dates, from the List's own dates or parsed from "(10/6 - 10/19)".
  startDate: string | null
  dueDate: string | null
}

const SPRINT_NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true })
const SPRINT_PATTERN = /\bsprints?\b/i
// "Sprint 12 (10/6 - 10/19)" — the Sprints ClickApp's default List name.
const NAME_RANGE_PATTERN = /\((\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\)/

function rangeFromName(
  name: string,
  referenceYear: number
): { startDate: string; dueDate: string } | null {
  const match = NAME_RANGE_PATTERN.exec(name)
  if (!match) {
    return null
  }
  const [startMonth, startDay, endMonth, endDay] = match.slice(1).map(Number)
  // A December-to-January Sprint ends in the following year.
  const endYear = endMonth < startMonth ? referenceYear + 1 : referenceYear
  const start = new Date(referenceYear, startMonth - 1, startDay)
  const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? null
    : { startDate: start.toISOString(), dueDate: end.toISOString() }
}

// Sprint Lists are those inside a Folder named like "Sprints" (where the
// Sprints ClickApp puts them) or Lists named like "Sprint 12".
export function detectClickUpSprints(
  lists: readonly ClickUpList[],
  now: Date = new Date()
): ClickUpSprint[] {
  return lists
    .filter(
      (list) => SPRINT_PATTERN.test(list.folder?.name ?? '') || SPRINT_PATTERN.test(list.name)
    )
    .map((list) => {
      const parsed =
        list.startDate || list.dueDate ? null : rangeFromName(list.name, now.getFullYear())
      return {
        listId: list.id,
        name: list.name,
        folderName: list.folder?.name,
        startDate: list.startDate ?? parsed?.startDate ?? null,
        dueDate: list.dueDate ?? parsed?.dueDate ?? null
      }
    })
    .sort((a, b) => {
      // Newest first; undated Sprints keep name order at the end.
      if (a.startDate && b.startDate) {
        return b.startDate.localeCompare(a.startDate)
      }
      if (a.startDate || b.startDate) {
        return a.startDate ? -1 : 1
      }
      return SPRINT_NAME_COLLATOR.compare(a.name, b.name)
    })
}

export function findCurrentClickUpSprint(
  sprints: readonly ClickUpSprint[],
  now: Date = new Date()
): ClickUpSprint | null {
  const time = now.getTime()
  return (
    sprints.find((sprint) => {
      if (!sprint.startDate || !sprint.dueDate) {
        return false
      }
      return Date.parse(sprint.startDate) <= time && time <= Date.parse(sprint.dueDate)
    }) ?? null
  )
}
