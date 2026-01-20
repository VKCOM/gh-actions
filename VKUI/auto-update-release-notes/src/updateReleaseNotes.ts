import { parsePullRequestReleaseNotesBody } from './parsing/parsePullRequestReleaseNotesBody.ts';
import { releaseNotesUpdater } from './parsing/releaseNotesUpdater.ts';
import type * as github from '@actions/github';
import { getRelease } from './getRelease.ts';
import { calculateReleaseVersion } from './calculateReleaseVersion.ts';
import { getPullRequestReleaseNotesBody } from './parsing/getPullRequestReleaseNotesBody.ts';
import { parsePullRequestLinkedIssue } from './parsing/parsePullRequestLinkedIssue.ts';
import { getMilestone } from './getMilestone.ts';

const EMPTY_NOTES = '-';

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
  let pullRequest;
  try {
    const { data: searchedPullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    pullRequest = searchedPullRequest;
  } catch (e) {}

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

  const pullRequestReleaseNotes =
    pullRequestReleaseNotesBody &&
    parsePullRequestReleaseNotesBody(pullRequestReleaseNotesBody, prNumber, otherAuthor);

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

  const release = await getRelease({
    owner,
    repo,
    octokit,
    releaseName,
  });

  if (!release || !release.draft) {
    return;
  }

  const releaseUpdater = releaseNotesUpdater(release.body || '');

  if (pullRequestReleaseNotes) {
    pullRequestReleaseNotes.forEach((note) => {
      releaseUpdater.addNotes({
        noteData: note,
        version: releaseVersion,
      });
    });
  } else {
    releaseUpdater.addUndescribedPRNumber(prNumber);
  }

  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    body: releaseUpdater.getBody(),
  });
};
