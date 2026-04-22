import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Context } from '../entities/context.ts';
import { PackageJson } from '../entities/package.ts';
import type { PackageRepository } from '../entities/repositories.ts';

export class Package implements PackageRepository {
  async packageJson(ctx: Context, packagePath: string) {
    const pkg = await fs
      .readFile(path.join(packagePath, 'package.json'), {
        encoding: 'utf-8',
        signal: ctx.signal,
      })
      .then(JSON.parse)
      .then(PackageJson.parse);

    return pkg;
  }

  async fileList(_ctx: Context, packagePath: string) {
    const entries = await fs.readdir(packagePath, { recursive: true, withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .map((filePath) => path.relative(packagePath, filePath));
  }
}
