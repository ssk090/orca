import type { RuntimeWorktreeRecord, RuntimeWorktreeRemoveResult } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { getRequiredWorktreeSelector } from '../selectors'
import { printHookWarning, printPreservedBranchWarning } from './worktree-removal-warnings'

export const worktreeRmHandler: CommandHandler = async ({ flags, client, cwd, json }) => {
  const worktree = await getRequiredWorktreeSelector(flags, 'worktree', cwd, client)
  const resolved = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree
  })
  const hostId = resolved.result.worktree.hostId
  if (!hostId) {
    throw new RuntimeClientError(
      'worktree_host_unresolved',
      'Orca cannot tell which host owns this workspace. Refresh projects and try again.'
    )
  }
  if (flags.get('allow-failed-archive-hook') === true && flags.get('run-hooks') !== true) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--allow-failed-archive-hook waives a FAILED archive hook, but without --run-hooks no hook runs at all. Pass --run-hooks too, or drop the waiver.'
    )
  }
  const result = await client.call<RuntimeWorktreeRemoveResult>('worktree.rm', {
    worktree,
    hostId,
    force: flags.get('force') === true,
    allowUnverifiedPtyStop: flags.get('force') === true,
    runHooks: flags.get('run-hooks') === true,
    allowFailedArchiveHook: flags.get('allow-failed-archive-hook') === true
  })
  printHookWarning(result.result, json)
  printPreservedBranchWarning(result.result, json)
  printResult(result, json, (value) =>
    value.removing
      ? `removed: ${value.removed}\nOrca is still deleting the checkout in the background.`
      : `removed: ${value.removed}`
  )
}
