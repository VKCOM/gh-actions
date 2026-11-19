import assert from 'node:assert/strict';
import { mkdir, mkdtempDisposable, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createTimingRecorder, measure } from './timings.ts';

test('continues deployment when the timings file cannot be created or appended to', async (t) => {
  await using directory = await mkdtempDisposable(join(tmpdir(), 'esm-timings-'));
  const timingsPath = join(directory.path, 'timings.ndjson');
  const warn = t.mock.method(console, 'warn', () => {});

  assert.equal(createTimingRecorder(directory.path), undefined);
  assert.equal(warn.mock.callCount(), 1);

  const recordTiming = createTimingRecorder(timingsPath);
  assert.ok(recordTiming);
  const ctx = { signal: t.signal, recordTiming };
  const deploymentError = new Error('S3 AccessDenied');

  await rename(timingsPath, join(directory.path, 'original.ndjson'));
  await mkdir(timingsPath);

  await assert.rejects(
    measure(ctx, 's3.PutObject', async () => {
      throw deploymentError;
    }),
    (error) => error === deploymentError,
  );
  assert.equal(await measure(ctx, 's3.PutObject', () => 'uploaded'), 'uploaded');
  assert.equal(warn.mock.callCount(), 2);
});
