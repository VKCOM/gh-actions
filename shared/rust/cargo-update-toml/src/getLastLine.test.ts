/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { getLastLine } from './getLastLine.ts';

describe('getLastLine', () => {
  it('returns the last line from a stream', async () => {
    const stream = new Readable();

    stream.push([1, 2, 3, 4].join('\n'));
    stream.push(null);

    const result = await getLastLine(stream);
    assert.strictEqual(result, '4');
  });
});
