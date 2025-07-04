import * as github from '@actions/github';
import { IconData } from './types';
import * as core from '@actions/core';

const ICON_FILE_REGEX = /^packages\/icons\/src\/svg\/([^\/]+)\/([^\/]+)\.svg$/;

export async function getChangedIconsData(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
) {
  // Получаем список измененных файлов в PR
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
  });
  // Фильтрация SVG-иконок
  const addedIcons: IconData[] = [];
  const modifiedIcons: IconData[] = [];
  const removedIcons: IconData[] = [];

  files.forEach((file) => {
    const match = file.filename.match(ICON_FILE_REGEX);
    if (!match) return;

    const [, size, name] = match;
    const icon = { name, size, url: file['raw_url'] };

    if (file.status === 'added') addedIcons.push(icon);
    else if (file.status === 'modified') modifiedIcons.push(icon);
    else if (file.status === 'removed') removedIcons.push(icon);
  });

  core.info(`Added icons: ${addedIcons.length}`);
  core.info(`Modified icons: ${modifiedIcons.length}`);
  core.info(`Modified icons: ${removedIcons.length}`);

  return {
    addedIcons,
    modifiedIcons,
    removedIcons,
  };
}
