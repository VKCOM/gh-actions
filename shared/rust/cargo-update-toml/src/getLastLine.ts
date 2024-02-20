import * as readline from 'node:readline/promises';

/**
 * Возвращает последнюю строку из стрима
 */
export function getLastLine(input: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface(input);

    let lastLine = '';
    rl.on('line', function (line) {
      lastLine = line;
    });

    rl.on('error', reject);

    rl.on('close', function () {
      resolve(lastLine);
    });
  });
}
