import * as github from '@actions/github';
import { IconData } from './types';
import * as core from '@actions/core';

const ICON_FILE_REGEX = /^packages\/icons\/src\/svg\/([^\/]+)\/([^\/]+)\.svg$/;

function convertToIconName(input: string): string {
  const parts = input.split('_');

  const nameParts = parts.slice(0, parts.length - 1);
  const size = parts[parts.length - 1];

  const formattedParts = nameParts.map(
    (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
  );

  return `Icon${size}${formattedParts.join('')}`;
}

export async function getChangedIconsData(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
) {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
  });
  const addedIcons: IconData[] = [];
  const modifiedIcons: IconData[] = [];

  files.forEach((file) => {
    const match = file.filename.match(ICON_FILE_REGEX);
    if (!match) {
      return;
    }

    const [, size, name] = match;
    const formattedName = convertToIconName(name);
    const icon = { name: formattedName, size, url: file['raw_url'] };

    if (file.status === 'added') {
      addedIcons.push(icon);
    } else if (file.status === 'modified') {
      modifiedIcons.push(icon);
    }
  });

  core.info(`Added icons: ${addedIcons.length}`);
  core.info(`Modified icons: ${modifiedIcons.length}`);

  return {
    addedIcons,
    modifiedIcons,
  };
}
