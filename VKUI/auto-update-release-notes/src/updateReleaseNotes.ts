import type * as github from '@actions/github';
import { calculateReleaseVersion } from './calculateReleaseVersion.ts';
import { getMilestone } from './getMilestone.ts';
import { getRcRelease } from './getRcRelease.ts';
import { getPullRequestReleaseNotesBody } from './parsing/getPullRequestReleaseNotesBody.ts';
import { parsePullRequestLinkedIssue } from './parsing/parsePullRequestLinkedIssue.ts';
import { parsePullRequestReleaseNotesBody } from './parsing/parsePullRequestReleaseNotesBody.ts';
import { updateReleaseByName } from './updateReleaseByName.ts';

const EMPTY_NOTES = '-';

const isMajorVersion = (version: string): boolean => /^\d+\.0\.0$/.test(version);

export const updateReleaseNotes = async ({
  octokit,
  owner,
  repo,
  prNumber,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
}) => {
  let pullRequest: Awaited<ReturnType<typeof octokit.rest.pulls.get>>['data'] | undefined;
  try {
    const { data: searchedPullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    pullRequest = searchedPullRequest;
  } catch (_e) {}

  if (!pullRequest) {
    return;
  }
  const pullRequestBody = pullRequest.body;
  const pullRequestLabels = pullRequest.labels;
  const author = pullRequest.user.login;

  const pullRequestReleaseNotesBody =
    pullRequestBody && getPullRequestReleaseNotesBody(pullRequestBody);

  if (pullRequestReleaseNotesBody === EMPTY_NOTES) {
    return;
  }

  const pullRequestLinkedIssue = pullRequestBody
    ? parsePullRequestLinkedIssue(pullRequestBody)
    : null;

  const milestone = await getMilestone({
    octokit,
    owner,
    repo,
    pullRequestMilestone: pullRequest.milestone,
    linkedIssueNumber: pullRequestLinkedIssue,
  });

  if (!pullRequestReleaseNotesBody && !milestone) {
    return;
  }

  const isFromForkedRepo = pullRequest.head.repo?.fork;
  const otherAuthor = isFromForkedRepo ? author : '';

  const pullRequestReleaseNotes = pullRequestReleaseNotesBody
    ? parsePullRequestReleaseNotesBody(pullRequestReleaseNotesBody, prNumber, otherAuthor)
    : null;

  const releaseData = await calculateReleaseVersion({
    octokit,
    repo,
    owner,
    labels: pullRequestLabels,
    milestone,
  });

  if (!releaseData || !releaseData.version) {
    return;
  }

  const { releaseName, version: releaseVersion } = releaseData;

  await updateReleaseByName({
    octokit,
    repo,
    owner,
    releaseName,
    releaseVersion,
    prNumber,
    newNotes: pullRequestReleaseNotes,
  });

  if (!isMajorVersion(releaseVersion)) {
    return;
  }

  const rcRelease = await getRcRelease({
    octokit,
    owner,
    repo,
    releaseVersion,
  });

  if (!rcRelease) {
    return;
  }

  await updateReleaseByName({
    octokit,
    repo,
    owner,
    releaseName: rcRelease.releaseName,
    releaseVersion: rcRelease.releaseVersion,
    prNumber,
    newNotes: pullRequestReleaseNotes,
  });
};
