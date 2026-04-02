import { CacheMap } from '../../lib/cache.ts';
import type { Context } from '../entities/context.ts';
import { PackageInstallInfo } from '../entities/npm.ts';
import type { NpmRepository } from '../entities/repositories.ts';
import { WrapperRepository } from './wrapper.ts';

export class Npm implements NpmRepository {
  readonly #registryURL: string;

  constructor(registryURL: string) {
    this.#registryURL = registryURL;
  }

  async packageMetadata(ctx: Context, name: string): Promise<PackageInstallInfo> {
    const url = `${this.#registryURL}/${name}`;
    const headers = { accept: 'application/vnd.npm.install-v1+json' };

    const response = await fetch(url, { signal: ctx.signal, headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch package ${name}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return PackageInstallInfo.parse(data);
  }
}

export class NpmCache extends WrapperRepository<NpmRepository> implements NpmRepository {
  #packageInstallInfoCache = new CacheMap<string, PackageInstallInfo>();

  packageMetadata(ctx: Context, name: string) {
    return this.#packageInstallInfoCache.getOrSet(name, () =>
      this.repository.packageMetadata(ctx, name),
    );
  }
}
