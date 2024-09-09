import { getNextReleaseVersion } from './getVersion';
import * as github from '@actions/github';

const parseReleaseVersion = (releaseVersion: string): string | null => {
  const match = releaseVersion.match(/v(\d+\.\d+\.\d+)/);
  return match?.[1] || null;
};

export async function calculateReleaseVersion({
  octokit,
  owner,
  repo,
  labels,
  milestone,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  labels: Array<{ name: string }>;
  milestone: { title: string } | null;
}): Promise<string | null> {
  if (milestone?.title) {
    return parseReleaseVersion(milestone.title);
  }
  let latestRelease;
  try {
    latestRelease = await octokit.rest.repos.getLatestRelease({
      repo,
      owner,
    });
  } catch (e) {
    return null;
  }

  const latestVersion = latestRelease.data.name && parseReleaseVersion(latestRelease.data.name);

  if (!latestVersion) {
    return null;
  }

  const hasPatchLabel = labels.some((label) => label.name === 'patch');
  const updateType = hasPatchLabel ? 'patch' : 'minor';

  return getNextReleaseVersion(latestVersion, updateType);
}
