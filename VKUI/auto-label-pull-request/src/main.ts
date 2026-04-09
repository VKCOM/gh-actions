import * as core from '@actions/core';
import * as github from '@actions/github';
import { getLabelColor, getLabelsByChangedFiles } from './labels.ts';

async function getChangedFilesFromPullRequest(
  octokit: ReturnType<typeof github.getOctokit>,
  pullNumber: number,
): Promise<string[]> {
  const {
    repo: { owner, repo },
  } = github.context;

  const pullFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return pullFiles.map((file) => file.filename);
}

function getExtraLabelsFromPullRequestData(pullRequest: {
  title?: string;
  user?: { login?: string };
}): string[] {
  const labels: string[] = [];
  const title = pullRequest.title ?? '';
  const userLogin = pullRequest.user?.login ?? '';

  if (title.startsWith('fix')) {
    labels.push('ci:cherry-pick:patch');
  }

  if (userLogin === 'dependabot[bot]' && title.includes('@vkontakte/vkui-tokens')) {
    labels.push('vkui-tokens');
  }

  return labels;
}

async function ensureLabelsExist(
  labels: string[],
  octokit: ReturnType<typeof github.getOctokit>,
): Promise<string[]> {
  const {
    repo: { owner, repo },
  } = github.context;

  const repositoryLabels = await octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  });
  const repositoryLabelNames = new Set(repositoryLabels.map((label) => label.name));

  const missingLabels = labels.filter((label) => !repositoryLabelNames.has(label));
  if (missingLabels.length > 0) {
    for (const label of missingLabels) {
      try {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label,
          color: getLabelColor(label),
        });
      } catch (error) {
        core.warning(`Cannot create label "${label}": ${String(error)}`);
      }
    }
  }

  return labels.filter((label) => repositoryLabelNames.has(label));
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const octokit = github.getOctokit(token);
    const pullNumber = Number(core.getInput('pull_request_number', { required: true }));

    const pullResponse = await octokit.rest.pulls.get({
      ...github.context.repo,
      pull_number: pullNumber,
    });
    const pullRequest = pullResponse.data;
    const changedFiles = await getChangedFilesFromPullRequest(octokit, pullNumber);

    const labels = new Set<string>([
      ...getLabelsByChangedFiles(changedFiles),
      ...getExtraLabelsFromPullRequestData({
        title: pullRequest.title,
        user: pullRequest.user ? { login: pullRequest.user.login } : undefined,
      }),
    ]);

    const filteredLabels = await ensureLabelsExist(Array.from(labels), octokit);

    if (filteredLabels.length > 0) {
      await octokit.rest.issues.addLabels({
        ...github.context.repo,
        issue_number: pullNumber,
        labels: filteredLabels,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
      return;
    }

    core.setFailed('Unknown error');
  }
}

void run();
