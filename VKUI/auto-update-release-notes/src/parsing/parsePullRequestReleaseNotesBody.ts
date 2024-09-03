import { ReleaseNoteData } from '../types';
import { releaseNotesUpdater } from './releaseNotesUpdater';

export function parsePullRequestReleaseNotesBody(
  releaseNotesBody: string,
  prNumber: number,
): ReleaseNoteData[] | null | '' {
  const updater = releaseNotesUpdater(releaseNotesBody);

  return updater.getReleaseNotesData().map((change) => ({
    ...change,
    data: change.data.map((item) => ({
      ...item,
      pullRequestNumber: prNumber,
    })),
  }));
}
