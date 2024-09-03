const RELEASE_NOTE_HEADER = '## Release notes\n';

export const getPullRequestReleaseNotesBody = (body: string): string | null => {
  const releaseNotesIndex = body.indexOf(RELEASE_NOTE_HEADER);
  if (releaseNotesIndex === -1) {
    return null;
  }

  return body.slice(releaseNotesIndex + RELEASE_NOTE_HEADER.length).trim();
};
