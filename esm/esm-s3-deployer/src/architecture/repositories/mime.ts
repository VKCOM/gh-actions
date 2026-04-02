import { lookup } from 'mime-types';
import type { Context } from '../entities/context.ts';
import type { MimeRepository } from '../entities/repositories.ts';

export class Mime implements MimeRepository {
  get(_ctx: Context, filenameOrExt: string) {
    return Promise.resolve(lookup(filenameOrExt) || 'binary/octet-stream');
  }
}
