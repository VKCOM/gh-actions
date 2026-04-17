export type Context = {
  signal: AbortSignal;
};

export function contextWithTimeout(ctx: Context, milliseconds: number): Context {
  return {
    ...ctx,
    signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(milliseconds)]),
  };
}
