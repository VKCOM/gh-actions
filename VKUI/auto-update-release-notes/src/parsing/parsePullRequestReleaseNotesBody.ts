import type { ReleaseNoteData } from '../types.ts';
import { releaseNotesUpdater } from './releaseNotesUpdater.ts';

export function parsePullRequestReleaseNotesBody(
  releaseNotesBody: string,
  pullRequestNumber: number,
  author: string,
): ReleaseNoteData[] | null | '' {
  const updater = releaseNotesUpdater(releaseNotesBody);

  return updater.getReleaseNotesData().map((change) => ({
    ...change,
    data: change.data.map((item) => ({
      ...item,
      pullRequestNumber,
      author,
    })),
  }));
}
