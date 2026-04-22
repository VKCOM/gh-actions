import * as fs from 'node:fs';
import * as fsPromise from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FSRepository } from '../entities/repositories.ts';

export class FS implements FSRepository {
  tmpPrefix = path.join(os.tmpdir(), 'esm-s3-deployer-');

  createReadStream(filePath: string) {
    return fs.createReadStream(filePath);
  }

  mkdtempDisposable() {
    return fsPromise.mkdtempDisposable(this.tmpPrefix);
  }
}
