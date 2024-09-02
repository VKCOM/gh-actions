import { parsePullRequestBody } from './parsing/parsePullRequestBody';
import { releaseNotesUpdater } from './parsing/releaseNotesUpdater';
import * as github from '@actions/github';
import { checkVKCOMMember } from './checkVKCOMMember';
import { getRelease } from './getRelease';
import { calculateReleaseVersion } from './calculateReleaseVersion';

export const updateReleaseNotes = async ({
  octokit,
  owner,
  repo,
  prNumber,
  currentVKUIVersion,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
  currentVKUIVersion: string;
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

  const pullRequestReleaseNotes =
    pullRequestBody && parsePullRequestBody(pullRequestBody, prNumber);

  const releaseVersion = calculateReleaseVersion({
    labels: pullRequestLabels,
    milestone: pullRequest.milestone,
    currentVKUIVersion,
  });

  const release = await getRelease({
    owner,
    repo,
    octokit,
    releaseVersion,
  });

  if (!release || !release.draft) {
    return;
  }

  const isVKCOMember = await checkVKCOMMember({ octokit, author });

  const releaseUpdater = releaseNotesUpdater(release.body || '');

  if (pullRequestReleaseNotes) {
    pullRequestReleaseNotes.forEach((note) => {
      releaseUpdater.addNotes({
        noteData: note,
        version: releaseVersion.slice(1),
        author: isVKCOMember ? '' : author,
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
