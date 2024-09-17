const CLOSE_ISSUE_NUMBER_REGEX = /close\s+#(\d+)/;

export const parsePullRequestLinkedIssue = (pullRequestBody: string) => {
  const match = pullRequestBody.match(CLOSE_ISSUE_NUMBER_REGEX);
  if (!match || !match[1]) {
    return null;
  }
  return Number(match[1]);
};
