import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
    let count = 18;

    async function retry(cb: () => Promise<void>, onError: () => Promise<void>) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        try {
          await cb();

          break;
        } catch (e) {
          console.error(e);

          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          count -= 1;

          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          if (count < 0) {
            throw e;
          }

          await onError();
        }
      }
    }

    await exec.exec('git', ['pull']);

    await retry(
      async () => {
        await exec.exec('git', ['add', './**/*.png']);

        try {
          await exec.exec('git', ['diff-index', '--quiet', 'HEAD']);
        } catch (e) {
          await exec.exec('git', ['commit', '-m', `CHORE: Update screenshots`]);
        }
      },
      async () => {
        await exec.exec('git', ['pull', '--rebase', '--autostash']);
      },
    );

    await retry(
      async () => {
        await exec.exec('git', ['push', '--verbose']);
      },
      async () => {
        await exec.exec('git', ['pull', '--rebase']);
      },
    );
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

void run();
