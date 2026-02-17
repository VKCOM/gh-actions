import type * as github from '@actions/github';
import { getRelease } from './getRelease.ts';
import { releaseNotesUpdater } from './parsing/releaseNotesUpdater.ts';
import type { ReleaseNoteData } from './types.ts';

type Parameters = {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  releaseName: string;
  releaseVersion: string;
  prNumber: number;
  newNotes: ReleaseNoteData[] | null;
};

export const updateReleaseByName = async ({
  octokit,
  owner,
  repo,
  releaseName,
  releaseVersion,
  newNotes,
  prNumber,
}: Parameters) => {
  const release = await getRelease({
    owner,
    repo,
    octokit,
    releaseName,
  });

  if (!release || !release.draft) {
    return;
  }

  const releaseUpdater = releaseNotesUpdater(release.body || '');

  if (newNotes) {
    newNotes.forEach((note) => {
      releaseUpdater.addNotes({
        noteData: note,
        version: releaseVersion,
      });
    });
  } else {
    releaseUpdater.addUndescribedPRNumber(prNumber);
  }

  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    body: releaseUpdater.getBody(),
  });
};
