import * as github from '@actions/github';
import * as core from '@actions/core';
import semver from 'semver';

function getNextMinorVersion(currentVersion: string): string {
  const nextVersion = semver.inc(currentVersion, 'minor');
  if (!nextVersion) throw new Error('Failed to increment version');
  return nextVersion;
}

export async function getReleaseDraft(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  currentIconsVersion: string,
) {
  const nextMinorVersion = getNextMinorVersion(currentIconsVersion);

  const releaseName = `@vkontakte/icons@v${nextMinorVersion}`;

  const releases = await octokit.paginate(octokit.rest.repos.listReleases, { owner, repo });
  let draftRelease = releases.find((r) => r.draft && r.name === releaseName);

  if (!draftRelease) {
    core.info('Creating new draft release');
    const response = await octokit.rest.repos.createRelease({
      owner,
      repo,
      name: releaseName,
      tag_name: releaseName,
      draft: true,
      body: '',
    });
    draftRelease = response.data;
  }

  core.info(`Updating draft release #${draftRelease.id}`);

  return draftRelease;
}
