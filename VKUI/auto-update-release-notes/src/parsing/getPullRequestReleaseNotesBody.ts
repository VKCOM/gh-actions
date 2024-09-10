const RELEASE_NOTE_HEADER = '## Release notes';
const COMMENT_START = '<!-- ';

export const getPullRequestReleaseNotesBody = (body: string): string | null => {
  const releaseNotesIndex = body.indexOf(RELEASE_NOTE_HEADER);
  if (releaseNotesIndex === -1) {
    return null;
  }
  const commentStart = body.indexOf(COMMENT_START, releaseNotesIndex);
  const end = commentStart !== -1 ? commentStart : body.length;

  return body.slice(releaseNotesIndex + RELEASE_NOTE_HEADER.length, end).trim();
};
