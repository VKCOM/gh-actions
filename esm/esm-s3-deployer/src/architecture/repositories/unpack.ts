import * as stream from 'node:stream/promises';
import * as tar from 'tar';
import type { Context } from '../entities/context.ts';
import type { UnpackRepository } from '../entities/repositories.ts';

export class Unpack implements UnpackRepository {
  async downloadAndUnpack(ctx: Context, url: string, destinationPath: string): Promise<void> {
    const response = await fetch(url, { signal: ctx.signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error(`Failed to fetch: body is null`);
    }

    await stream.pipeline(
      response.body,
      tar.x({
        cwd: destinationPath,
        strict: true,
        strip: 1,
      }),
      { signal: ctx.signal },
    );
  }
}
