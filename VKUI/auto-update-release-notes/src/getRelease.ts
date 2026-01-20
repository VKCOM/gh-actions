import type * as github from '@actions/github';

type ArrayElement<ArrayType extends any[]> =
  ArrayType extends Array<infer ElementType> ? ElementType : never;

type Octokit = ReturnType<typeof github.getOctokit>;

type ReleaseData = ArrayElement<
  Awaited<ReturnType<Octokit['rest']['repos']['listReleases']>>['data']
>;

async function getRecentDraftReleaseByName({
  octokit,
  owner,
  repo,
  releaseName,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  releaseName: string;
}): Promise<ReleaseData | null> {
  try {
    const response = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 10,
    });

    const searchedRelease = response.data
      .filter((release) => release.draft)
      .find((release) => release.name === releaseName);

    return searchedRelease || null;
  } catch (error) {
    return null;
  }
}

export async function getRelease({
  octokit,
  owner,
  repo,
  releaseName,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  releaseName: string;
}) {
  try {
    const searchedRelease = await getRecentDraftReleaseByName({
      octokit,
      owner,
      repo,
      releaseName,
    });
    if (searchedRelease) {
      return searchedRelease;
    }
  } catch (e) {}
  try {
    const { data: createdRelease } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: releaseName,
      name: releaseName,
      body: '',
      draft: true,
      prerelease: false,
    });
    return createdRelease;
  } catch (e) {}

  return null;
}
