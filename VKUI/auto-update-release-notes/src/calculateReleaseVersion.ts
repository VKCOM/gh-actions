import { getNextReleaseVersion } from './getVersion';
import * as github from '@actions/github';

type ReleaseData = {
  releaseName: string;
  version: string | null;
};

const parseReleaseVersion = (releaseVersion: string): string | null => {
  const match = releaseVersion.match(/v(\d+\.\d+\.\d+(-beta\.\d+)?)/);
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
}): Promise<ReleaseData | null> {
  if (milestone?.title) {
    return {
      releaseName: milestone.title,
      version: parseReleaseVersion(milestone.title),
    };
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
  const nextVersion = getNextReleaseVersion(latestVersion, updateType);

  return {
    releaseName: `v${nextVersion}`,
    version: nextVersion,
  };
}
