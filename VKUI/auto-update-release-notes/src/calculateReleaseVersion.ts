import type * as github from '@actions/github';
import { getNextReleaseVersion } from './getVersion.ts';

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
  let latestRelease: Awaited<ReturnType<typeof octokit.rest.repos.getLatestRelease>>;
  try {
    latestRelease = await octokit.rest.repos.getLatestRelease({
      repo,
      owner,
    });
  } catch (_e) {
    return null;
  }

  const latestVersion = latestRelease.data.name && parseReleaseVersion(latestRelease.data.name);

  if (!latestVersion) {
    return null;
  }

  const hasPatchLabel = labels.some((label) => label.name === 'ci:cherry-pick:patch');
  const updateType = hasPatchLabel ? 'patch' : 'minor';
  const nextVersion = getNextReleaseVersion(latestVersion, updateType);

  return {
    releaseName: `v${nextVersion}`,
    version: nextVersion,
  };
}
