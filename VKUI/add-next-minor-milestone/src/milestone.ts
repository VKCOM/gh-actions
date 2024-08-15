import * as github from '@actions/github';

// Получает milestone по версии
export async function getMilestone(octokit: ReturnType<typeof github.getOctokit>, version: string) {
  const { owner, repo } = github.context.repo;
  const { data: milestones } = await octokit.rest.issues.listMilestones({
    owner,
    repo,
    state: 'open',
  });

  return milestones.find((m) => m.title === `v${version}`);
}

// Создает новый milestone
export async function createMilestone(
  octokit: ReturnType<typeof github.getOctokit>,
  version: string,
) {
  const { owner, repo } = github.context.repo;
  const { data: milestone } = await octokit.rest.issues.createMilestone({
    owner,
    repo,
    title: `v${version}`,
    state: 'open',
  });

  return milestone;
}

// Добавляет milestone к PR
export async function addMilestoneToPR(
  octokit: ReturnType<typeof github.getOctokit>,
  prNumber: number,
  milestoneNumber: number,
): Promise<void> {
  const { owner, repo } = github.context.repo;
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: prNumber,
    milestone: milestoneNumber,
  });
}
