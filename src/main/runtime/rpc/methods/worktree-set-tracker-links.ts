import type { z } from 'zod'
import type { WorktreeSet } from '../../../../shared/rpc-contract/worktree-params'

type WorktreeSetParams = z.infer<typeof WorktreeSet>

/** Linear and ClickUp links travel as legacy meta fields; undefined leaves the stored link untouched. */
export function pickWorktreeSetTrackerLinks(params: WorktreeSetParams) {
  return {
    linkedLinearIssue: params.linkedLinearIssue,
    linkedLinearIssueWorkspaceId: params.linkedLinearIssueWorkspaceId,
    linkedLinearIssueOrganizationUrlKey: params.linkedLinearIssueOrganizationUrlKey,
    linkedClickUpTaskId: params.linkedClickUpTaskId,
    linkedClickUpWorkspaceId: params.linkedClickUpWorkspaceId
  }
}
