import * as github from '@actions/github';
import * as core from '@actions/core';

export async function getReleaseDraft(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
) {
  // Получаем список релизов
  const releases = await octokit.paginate(octokit.rest.repos.listReleases, { owner, repo });
  let draftRelease = releases.find((r) => r.draft && r.name?.startsWith('@vkontakte/icons'));

  // Создаем черновик если нет
  if (!draftRelease) {
    core.info('Creating new draft release');
    const response = await octokit.rest.repos.createRelease({
      owner,
      repo,
      // Для упрощения логики при создании черновика создаем релиз с названием @vkontakte/icons@latest.
      // После того как релиз создастся нужно будет вручную поменять версию в названии и в теге.
      name: '@vkontakte/icons@latest',
      tag_name: `@vkontakte/icons@latest`,
      draft: true,
      body: '',
    });
    draftRelease = response.data;
  }

  core.info(`Updating draft release #${draftRelease.id}`);

  return draftRelease;
}
