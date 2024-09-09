import { parsePullRequestReleaseNotesBody } from './parsing/parsePullRequestReleaseNotesBody';
import { releaseNotesUpdater } from './parsing/releaseNotesUpdater';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { checkVKCOMMember } from './checkVKCOMMember';
import { getRelease } from './getRelease';
import { calculateReleaseVersion } from './calculateReleaseVersion';
import { getPullRequestReleaseNotesBody } from './parsing/getPullRequestReleaseNotesBody';

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
  core.debug(`[updateReleaseNotes] pull request: ${JSON.stringify(pullRequest)}`);
  core.debug(`[updateReleaseNotes] pull request body: ${pullRequest.body}`);
  const pullRequestBody = pullRequest.body;
  const pullRequestLabels = pullRequest.labels;
  const author = pullRequest.user.login;

  const pullRequestReleaseNotesBody =
    pullRequestBody && getPullRequestReleaseNotesBody(pullRequestBody);

  core.debug(
    `[updateReleaseNotes] pull request pullRequestReleaseNotesBody: ${pullRequestReleaseNotesBody}`,
  );

  if (pullRequestReleaseNotesBody === EMPTY_NOTES) {
    return;
  }

  const pullRequestReleaseNotes =
    pullRequestReleaseNotesBody &&
    parsePullRequestReleaseNotesBody(pullRequestReleaseNotesBody, prNumber);

  core.debug(
    `[updateReleaseNotes] pullRequestReleaseNotes count: ${pullRequestReleaseNotes?.length}`,
  );

  const releaseVersion = await calculateReleaseVersion({
    octokit,
    repo,
    owner,
    labels: pullRequestLabels,
    milestone: pullRequest.milestone,
  });

  core.debug(`[updateReleaseNotes] releaseVersion: ${releaseVersion}`);
  if (!releaseVersion) {
    return;
  }

  const release = await getRelease({
    owner,
    repo,
    octokit,
    releaseVersion,
  });
  core.debug(`[updateReleaseNotes] release: ${JSON.stringify(release)}`);

  if (!release || !release.draft) {
    return;
  }

  const isVKCOMember = await checkVKCOMMember({ octokit, author });

  core.debug(`[updateReleaseNotes] isVKCOMember: ${isVKCOMember}`);

  const releaseUpdater = releaseNotesUpdater(release.body || '');

  if (pullRequestReleaseNotes) {
    pullRequestReleaseNotes.forEach((note) => {
      releaseUpdater.addNotes({
        noteData: note,
        version: releaseVersion,
        author: isVKCOMember ? '' : author,
      });
    });
  } else {
    releaseUpdater.addUndescribedPRNumber(prNumber);
  }

  core.debug(`[updateReleaseNotes] result release notes: ${releaseUpdater.getBody()}`);

  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    body: releaseUpdater.getBody(),
  });
};
