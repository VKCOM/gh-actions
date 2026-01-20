import type * as github from '@actions/github';

type MilestoneData = { title: string };

export const getMilestone = async ({
  octokit,
  owner,
  repo,
  pullRequestMilestone,
  linkedIssueNumber,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  pullRequestMilestone: MilestoneData | null;
  linkedIssueNumber: number | null;
}): Promise<MilestoneData | null> => {
  if (pullRequestMilestone) {
    return pullRequestMilestone;
  }
  if (!linkedIssueNumber) {
    return null;
  }
  try {
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: linkedIssueNumber,
    });
    return issue.milestone;
  } catch (e) {
    return null;
  }
};
