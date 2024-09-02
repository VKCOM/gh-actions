import { ReleaseNoteData } from '../types';
import { releaseNotesUpdater } from './releaseNotesUpdater';

const RELEASE_NOTE_HEADER = '## Release notes\n';

export function parsePullRequestBody(body: string, prNumber: number): ReleaseNoteData[] | null {
  const releaseNotesIndex = body.indexOf(RELEASE_NOTE_HEADER);
  if (releaseNotesIndex === -1) {
    return null;
  }

  const releaseNotesPart = body.slice(releaseNotesIndex + RELEASE_NOTE_HEADER.length);

  const updater = releaseNotesUpdater(releaseNotesPart);

  return updater.getReleaseNotesData().map((change) => ({
    ...change,
    data: change.data.map((item) => ({
      ...item,
      pullRequestNumber: prNumber,
    })),
  }));
}
