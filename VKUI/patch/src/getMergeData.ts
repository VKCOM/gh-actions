import * as exec from '@actions/exec';
import type * as github from '@actions/github';

const MINIMUM_MERGE_COMMIT_COUNT = 2;

export type MergeMethod = 'merge' | 'squash';

export type MergeData = {
  method: MergeMethod;
  mergeCommitSHA: string;
};

export async function getMergeData(
  gh: ReturnType<typeof github.getOctokit>,
  repo: typeof github.context.repo,
  pullNumber: number,
): Promise<MergeData> {
  const pullRequest = await gh.rest.pulls.get({ ...repo, pull_number: pullNumber });
  const mergeCommitSHA = pullRequest.data.merge_commit_sha || '';

  let method: MergeMethod = 'merge';

  try {
    await exec.exec('git', ['show', '-s', '--pretty=%p', mergeCommitSHA], {
      listeners: {
        stdout: (dataRaw: Buffer) => {
          const data = dataRaw.toString().trim().split(' ');
          method = data.length >= MINIMUM_MERGE_COMMIT_COUNT ? 'merge' : 'squash';
        },
      },
    });
  } catch (e) {
    console.error(e);
  }

  return {
    method,
    mergeCommitSHA,
  };
}
