import { ChevronDown, GanttChart, List } from 'lucide-react'
import type { ClickUpSpace, ClickUpStatus } from '../../../shared/clickup-types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import type { ClickUpSprint } from './clickup-sprints'
import type { ClickUpSprintSelection, ClickUpTaskViewMode } from './clickup-task-view-preferences'

const ALL_SPACES = '__all__'

export function ClickUpSpaceSelect({
  spaces,
  spaceId,
  onSpaceChange
}: {
  spaces: readonly ClickUpSpace[]
  spaceId: string | null
  onSpaceChange: (spaceId: string | null) => void
}): React.JSX.Element {
  return (
    <Select
      value={spaceId ?? ALL_SPACES}
      onValueChange={(value) => onSpaceChange(value === ALL_SPACES ? null : value)}
    >
      <SelectTrigger
        className="h-8 w-[170px]"
        aria-label={translate('auto.components.clickup.filters.space', 'Space')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SPACES}>
          {translate('auto.components.clickup.filters.allSpaces', 'All Spaces')}
        </SelectItem>
        {spaces.map((space) => (
          <SelectItem key={space.id} value={space.id}>
            {space.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function sprintValue(selection: ClickUpSprintSelection): string {
  return typeof selection === 'string' ? selection : `list:${selection.listId}`
}

function sprintLabel(
  selection: ClickUpSprintSelection,
  sprints: readonly ClickUpSprint[],
  current: ClickUpSprint | null
): string {
  if (selection === 'all') {
    return translate('auto.components.clickup.filters.allSprints', 'All sprints')
  }
  if (selection === 'current') {
    return current
      ? translate('auto.components.clickup.filters.currentSprintNamed', 'Current: {{name}}', {
          name: current.name
        })
      : translate('auto.components.clickup.filters.noCurrentSprint', 'No current sprint')
  }
  return (
    sprints.find((sprint) => sprint.listId === selection.listId)?.name ??
    translate('auto.components.clickup.filters.sprint', 'Sprint')
  )
}

export function ClickUpSprintMenu({
  sprints,
  current,
  selection,
  onSelectionChange
}: {
  sprints: readonly ClickUpSprint[]
  current: ClickUpSprint | null
  selection: ClickUpSprintSelection
  onSelectionChange: (selection: ClickUpSprintSelection) => void
}): React.JSX.Element {
  // Why: spaces like Chip1 run parallel sprint folders (Dev, Weekly, QE), so
  // same-dated sprints need their folder to be told apart.
  const showFolders = new Set(sprints.map((sprint) => sprint.folderName)).size > 1
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px]">
          <span className="truncate">{sprintLabel(selection, sprints, current)}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <div className="max-h-80 overflow-y-auto scrollbar-sleek">
          <DropdownMenuRadioGroup
            value={sprintValue(selection)}
            onValueChange={(value) => {
              if (value === 'current' || value === 'all') {
                onSelectionChange(value)
              } else if (value.startsWith('list:')) {
                onSelectionChange({ listId: value.slice('list:'.length) })
              }
            }}
          >
            <DropdownMenuRadioItem value="current">
              {translate('auto.components.clickup.filters.currentSprint', 'Current sprint')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all">
              {translate('auto.components.clickup.filters.allSprints', 'All sprints')}
            </DropdownMenuRadioItem>
            {sprints.length > 0 ? <DropdownMenuSeparator /> : null}
            {sprints.map((sprint) => (
              <DropdownMenuRadioItem key={sprint.listId} value={`list:${sprint.listId}`}>
                <span className="truncate">{sprint.name}</span>
                {showFolders && sprint.folderName ? (
                  <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted-foreground">
                    {sprint.folderName}
                  </span>
                ) : null}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ClickUpStatusMenu({
  options,
  selected,
  onSelectedChange
}: {
  options: readonly ClickUpStatus[]
  selected: readonly string[]
  onSelectedChange: (statuses: string[]) => void
}): React.JSX.Element {
  const selectedKeys = new Set(selected.map((name) => name.toLocaleLowerCase()))
  const label =
    selected.length === 0
      ? translate('auto.components.clickup.filters.anyStatus', 'Any status')
      : selected.length === 1
        ? selected[0]
        : translate('auto.components.clickup.filters.statusCount', '{{count}} statuses', {
            count: selected.length
          })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[180px]">
          <span className="truncate">{label}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>
          {translate('auto.components.clickup.filters.status', 'Status')}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onSelectedChange(options.map((status) => status.name))
          }}
        >
          {translate('auto.components.clickup.filters.selectAll', 'Select all')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onSelectedChange([])
          }}
        >
          {translate('auto.components.clickup.filters.clear', 'Clear')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto scrollbar-sleek">
          {options.map((status) => (
            <DropdownMenuCheckboxItem
              key={status.name}
              checked={selectedKeys.has(status.name.toLocaleLowerCase())}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onSelectedChange(
                  checked
                    ? [...selected, status.name]
                    : selected.filter(
                        (name) => name.toLocaleLowerCase() !== status.name.toLocaleLowerCase()
                      )
                )
              }
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="truncate">{status.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ClickUpViewToggle({
  view,
  onViewChange
}: {
  view: ClickUpTaskViewMode
  onViewChange: (view: ClickUpTaskViewMode) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(value) => {
        if (value === 'list' || value === 'gantt') {
          onViewChange(value)
        }
      }}
      aria-label={translate('auto.components.clickup.filters.view', 'ClickUp view')}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="list">
        <List />
        {translate('auto.components.clickup.filters.list', 'List')}
      </ToggleGroupItem>
      <ToggleGroupItem value="gantt">
        <GanttChart />
        {translate('auto.components.clickup.filters.gantt', 'Gantt')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
