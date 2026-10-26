import type * as github from '@actions/github';

const RELEASES_PAGE_SIZE = 10;

const findLatestRcReleaseName = (
  releases: Array<{ name: string | null; tag_name: string | null }>,
  major: number,
): string | null => {
  const rcPattern = new RegExp(`^v${major}\\.0\\.0-rc\\.\\d+$`);
  for (const r of releases) {
    const name = r.name || r.tag_name || '';
    if (rcPattern.test(name)) {
      return name;
    }
  }
  return null;
};

const parseVersionFromReleaseName = (releaseName: string): string =>
  releaseName.startsWith('v') ? releaseName.slice(1) : releaseName;

export type RcRelease = {
  releaseName: string;
  releaseVersion: string;
};

export const getRcRelease = async ({
  octokit,
  owner,
  repo,
  releaseVersion,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  releaseVersion: string;
}): Promise<RcRelease | null> => {
  const major = parseInt(releaseVersion.split('.')[0], 10);
  if (Number.isNaN(major)) {
    return null;
  }

  let releases: Array<{ name: string | null; tag_name: string | null }>;
  try {
    const { data } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: RELEASES_PAGE_SIZE,
    });
    releases = data;
  } catch {
    return null;
  }

  const rcReleaseName = findLatestRcReleaseName(releases, major);
  if (!rcReleaseName) {
    return null;
  }

  return {
    releaseName: rcReleaseName,
    releaseVersion: parseVersionFromReleaseName(rcReleaseName),
  };
};
