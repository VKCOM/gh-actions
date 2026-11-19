import { appendFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import type { Context } from '../architecture/entities/context.ts';

export type OperationTiming = {
  operation: string;
  target?: string | undefined;
  startedAtMs: number;
  durationMs: number;
  status: 'success' | 'error';
};

export function createTimingRecorder(filePath: string): Context['recordTiming'] {
  let enabled = true;

  function disable(error: unknown) {
    enabled = false;
    console.warn(`Could not write deployment timings to ${filePath}`, error);
  }

  try {
    writeFileSync(filePath, '');
  } catch (error) {
    disable(error);
    return undefined;
  }

  return (timing) => {
    if (!enabled) return;

    try {
      appendFileSync(filePath, `${JSON.stringify(timing)}\n`);
    } catch (error) {
      disable(error);
    }
  };
}

export async function measure<T>(
  { recordTiming }: Context,
  operation: string,
  run: () => T | Promise<T>,
  target?: string,
): Promise<T> {
  if (!recordTiming) return run();

  const started = performance.now();
  let status: OperationTiming['status'] = 'error';

  try {
    const result = await run();
    status = 'success';
    return result;
  } finally {
    recordTiming({
      operation,
      target,
      startedAtMs: performance.timeOrigin + started,
      durationMs: performance.now() - started,
      status,
    });
  }
}
