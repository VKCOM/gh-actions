// см. https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
const keywords = [
  'close',
  'closes',
  'closed',
  'fix',
  'fixes',
  'fixed',
  'resolve',
  'resolves',
  'resolved',
];

const startGroup = '(|-\\s)';
const keywordsGroup = `(${keywords.join('|')})`;
const issueNumberRegexStr = '#(\\d+)';

const linkedIssueRegExp = new RegExp(
  `^${startGroup}${keywordsGroup}\\s${issueNumberRegexStr}`,
  'mi',
);

const ISSUE_NUMBER_MATCH_INDEX = 3;

export const parsePullRequestLinkedIssue = (pullRequestBody: string) => {
  const match = pullRequestBody.match(linkedIssueRegExp);
  if (!match || !match[ISSUE_NUMBER_MATCH_INDEX]) {
    return null;
  }
  return Number(match[ISSUE_NUMBER_MATCH_INDEX]);
};
