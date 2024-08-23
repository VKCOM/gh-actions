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
  // Получаем информацию о релизе
  let { data: release } = await octokit.rest.repos.getReleaseByTag({
    owner,
    repo,
    tag: releaseVersion,
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!release) {
    const { data: createdRelease } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: releaseVersion,
      name: `Release ${releaseVersion}`,
      body: '',
      draft: true,
      prerelease: false,
    });
    release = createdRelease;
  }
  return release;
}
