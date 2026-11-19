import type { OperationTiming } from '../../lib/timings.ts';

export type Context = {
  signal: AbortSignal;
  recordTiming?: (timing: OperationTiming) => void;
};

export function contextWithTimeout(ctx: Context, milliseconds: number): Context {
  return {
    ...ctx,
    signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(milliseconds)]),
  };
}
