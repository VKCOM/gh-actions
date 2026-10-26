import type * as github from '@actions/github';
import semver from 'semver';

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
  milestone,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
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

  const nextVersion = semver.inc(latestVersion, 'minor');
  if (!nextVersion) {
    return null;
  }

  return {
    releaseName: `v${nextVersion}`,
    version: nextVersion,
  };
}
