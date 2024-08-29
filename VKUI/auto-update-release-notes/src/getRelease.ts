import * as github from '@actions/github';

export async function getRelease({
  octokit,
  owner,
  repo,
  releaseVersion,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  releaseVersion: string;
}) {
  let resultRelease;
  try {
    // Получаем информацию о релизе
    const { data: searchedRelease } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: releaseVersion,
    });
    resultRelease = searchedRelease;
  } catch (e) {
    if (e instanceof Error && 'status' in e && e.status === 404) {
      const { data: createdRelease } = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: releaseVersion,
        name: `Release ${releaseVersion}`,
        body: '',
        draft: true,
        prerelease: false,
      });
      resultRelease = createdRelease;
    }
  }
  return resultRelease;
}
