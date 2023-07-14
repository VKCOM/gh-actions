import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { SemVer } from 'semver';
import { getPatchInstructions } from './message';
import { getMergeData } from './getMergeData';
import { stableBranchName } from './stableBranchName';

function getPrNumber() {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    throw new Error('Not found PR number');
  }
  return pullRequest.number;
}

function getStableBranchRef(directory: string) {
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8'));
  const semVer = new SemVer(pkg.version);
  return stableBranchName(semVer);
}

function filterCommitByMessage(message: string) {
  if (message.includes('CHORE: Update screenshots')) {
    return false;
  }
  if (message.startsWith('Merge branch')) {
    return false;
  }
  return true;
}

function remoteRepository(token: string) {
  const {
    actor,
    repo: { owner, repo },
  } = github.context;

  return `https://${actor}:${token}@github.com/${owner}/${repo}`;
}

async function run(): Promise<void> {
  try {
    const forked =
      github.context.payload.pull_request?.base.repo.id !==
      github.context.payload.pull_request?.head.repo.id;
    const token = core.getInput('token', { required: true });
    const directory = core.getInput('directory');
    const pullNumber = getPrNumber();

    const gh = github.getOctokit(token);
    const mergeData = await getMergeData(gh, github.context.repo, pullNumber);
    const patchRefs = [];

    if (mergeData.method === 'squash') {
      patchRefs.push(mergeData.mergeCommitSHA);
    } else {
      const patchCommits = await gh.rest.pulls.listCommits({
        ...github.context.repo,
        pull_number: pullNumber,
      });
      patchRefs.push(
        ...patchCommits.data
          .filter((commit) => filterCommitByMessage(commit.commit.message))
          .map((commit) => commit.sha),
      );
    }

    const createComment = async (body: string) => {
      await gh.rest.issues.createComment({
        ...github.context.repo,
        issue_number: pullNumber,
        body,
      });
    };
    const stableBranchRef = getStableBranchRef(directory);

    if (forked) {
      const message = getPatchInstructions(
        '⚠️ Patch (forked repo)',
        'Необходимо вручную перенести исправление в стабильную ветку.',
        {
          stableBranchRef,
          pullNumber,
          patchRefs,
        },
      );

      await createComment(message);
      core.warning('Необходимо вручную перенести исправление в стабильную ветку');

      return;
    }

    try {
      if (mergeData.method === 'squash') {
        await exec.exec('git', ['fetch', '--no-tags', 'origin', stableBranchRef]);
        await exec.exec('git', [
          'fetch',
          '--no-tags',
          // Перед cherry-pick'ом squash коммита, фетчим этот коммит с флагом `--depth=2`, чтобы
          // перебить параметр `fetch-depth` у `@actions/checkout`, который по умолчанию равен 1.
          '--depth=2',
          'origin',
          ...patchRefs,
        ]);
      } else {
        await exec.exec('git', ['fetch', '--no-tags', 'origin', stableBranchRef, ...patchRefs]);
      }
      await exec.exec('git', ['checkout', stableBranchRef]);

      for (const patchRef of patchRefs) {
        await exec.exec('git', ['cherry-pick', '--no-commit', patchRef]);
        // Исключаем файлы со скриншотами, т.к. предполагаем, что в стабильной ветке
        // заведомо всё в порядке.
        await exec.exec('git', ['checkout', 'HEAD', '**/__image_snapshots__/*.png']);

        const exitDiffCode = await exec.exec('git', ['diff', '--quiet', 'HEAD'], {
          ignoreReturnCode: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const hasCodeToCommit = exitDiffCode !== 0;
        if (hasCodeToCommit) {
          await exec.exec('git', ['commit', '--no-verify', '--no-edit']);
        }
      }
    } catch (e) {
      console.error(e);

      const message = getPatchInstructions(
        '❌ Patch',
        'Не удалось автоматически применить исправление на стабильной ветке.',
        {
          stableBranchRef,
          pullNumber,
          patchRefs,
        },
      );

      await createComment(message);
      throw new Error('Не удалось автоматически применить исправление на стабильной ветке');
    }

    await exec.exec('git', [
      'push',
      `${remoteRepository(token)}`,
      `HEAD:refs/heads/${stableBranchRef}`,
      '--verbose',
    ]);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
