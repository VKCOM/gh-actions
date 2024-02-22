import { expect, test } from '@jest/globals';
import { Readable } from 'node:stream';
import { getLastLine } from './getLastLine';

test('getLastLine', async () => {
  const stream = new Readable();

  stream.push([1, 2, 3, 4].join('\n'));
  stream.push(null);

  expect(await getLastLine(stream)).toBe('4');
});
