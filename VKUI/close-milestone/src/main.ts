import * as core from '@actions/core';
import * as github from '@actions/github';

async function wait(milliseconds: number): Promise<string> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const COMMENT_WAIT_INTERVAL_MS = 1500;

type OctokitProp = ReturnType<typeof github.getOctokit>;

async function findMilestoneNumberByReleaseTag(gh: OctokitProp, releaseTag: string) {
  const { data: milestones } = await gh.rest.issues.listMilestones({
    ...github.context.repo,
    state: 'open',
  });

  const milestone = milestones.find(({ title }) => title === releaseTag);

  if (milestone) {
    return milestone.number;
  }

  throw new Error(`Не удалось найти milestone для ${releaseTag}`);
}

async function getIssueNumbersByMilestone(gh: OctokitProp, milestoneNumber: number) {
  const issues = await gh.paginate(gh.rest.issues.listForRepo, {
    ...github.context.repo,
    milestone: `${milestoneNumber}`,
  });

  return issues.map((issue) => issue.number);
}

async function commentOnIssues(gh: OctokitProp, issueNumbers: number[], releaseTag: string) {
  const {
    repo: { repo, owner },
  } = github.context;

  const url = `https://github.com/${owner}/${repo}/releases/tag/${releaseTag}`;
  const body = `Требуемая функциональность была реализована в рамках <a href="${url}" target="_blank">${releaseTag}</a>.`;

  for (let issue_number of issueNumbers) {
    await gh.rest.issues.createComment({
      repo,
      owner,
      issue_number,
      body,
    });

    // https://docs.github.com/en/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits
    await wait(COMMENT_WAIT_INTERVAL_MS);
  }
}

async function closeMilestone(gh: OctokitProp, milestone_number: number) {
  await gh.rest.issues.updateMilestone({
    ...github.context.repo,
    milestone_number,
    state: 'closed',
  });
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const releaseTag = core.getInput('releaseTag', { required: true });
    const gh = github.getOctokit(token);

    const milestoneNumber = await findMilestoneNumberByReleaseTag(gh, releaseTag);
    const issueNumbers = await getIssueNumbersByMilestone(gh, milestoneNumber);

    await commentOnIssues(gh, issueNumbers, releaseTag);

    await closeMilestone(gh, milestoneNumber);
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
