import * as github from '@actions/github';
import * as core from '@actions/core';
import { releaseNotesParser } from './releaseNotesParser';
import { getChangedIconsData } from './getChangedIconsData';
import { getReleaseDraft } from './getReleaseDraft';

const ADDED_SECTION_HEADER = 'Добавленные иконки';
const MODIFIED_SECTION_HEADER = 'Измененные иконки';

export async function updateReleaseNotes({
  octokit,
  owner,
  repo,
  prNumber,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
}) {
  const { addedIcons, modifiedIcons } = await getChangedIconsData(octokit, owner, repo, prNumber);

  if (!addedIcons.length && !modifiedIcons.length) {
    core.info('No icon changes detected. Skipping release update.');
    return;
  }
  const draftRelease = await getReleaseDraft(octokit, owner, repo);

  const parser = releaseNotesParser(draftRelease.body || '');

  parser.modifySection(ADDED_SECTION_HEADER, addedIcons);
  parser.modifySection(MODIFIED_SECTION_HEADER, modifiedIcons);

  // Обновляем релиз
  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: draftRelease.id,
    body: parser.body,
  });

  core.info('Release draft updated successfully with icon previews');
}
