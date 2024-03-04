import * as exec from '@actions/exec';

/**
 * Возвращает текущий хэш и таймстемп
 */
export async function getHashAndTimestamp(): Promise<`${string},${string},`> {
  const output = await exec.getExecOutput('git', [
    'show',
    'HEAD',
    '--pretty=format:"%H,%at,"',
    '--no-patch',
  ]);

  return output.stdout as `${string},${string},`;
}
