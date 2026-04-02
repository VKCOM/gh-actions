import { CacheMap } from '../../lib/cache.ts';
import { promiseRecordMap } from '../../lib/error.ts';
import { isNotUndefined } from '../../lib/isNotUndefined.ts';
import { reverseMap } from '../../lib/reverseMap.ts';
import type { Context } from '../entities/context.ts';
import { contextWithTimeout } from '../entities/context.ts';
import type { PackageInstallInfo } from '../entities/npm.ts';
import { Service } from './service.ts';

export type PackageVersionDependency = {
  name: string;
  version: string;
};

export type PackageVersion = {
  name: string;
  version: string;
  tarball: string;
  dependencies: Array<PackageVersionDependency>;
  majorTag: string | null;
};

export class RegistryService extends Service {
  #resolveCache = new CacheMap<string, PackageVersion>();

  async #registryContext(ctx: Context): Promise<Context> {
    const configuration = await this.repositories.configuration.get(ctx);

    return contextWithTimeout(ctx, configuration.timeout.registry);
  }

  async resolve(ctx: Context, name: string, range: string): Promise<PackageVersion[]> {
    const packageInstallInfo = await this.repositories.npm.packageMetadata(
      await this.#registryContext(ctx),
      name,
    );

    const resolveResult = await promiseRecordMap(
      packageInstallInfo.versions,
      async ([version, versionInfo]) => {
        if (!this.repositories.semver.satisfies(version, range)) {
          return;
        }

        const packageVersion = await this.#resolveVersion(ctx, name, versionInfo);

        return packageVersion;
      },
    );

    const packages = resolveResult.filter(isNotUndefined);

    const latestByMajor = this.repositories.semver.latestByMajor(
      packages.map((version) => version.version),
    );

    const majorByLatest = reverseMap(latestByMajor);

    for (const version of packages) {
      const major = majorByLatest.get(version.version);
      if (major === undefined) continue;

      version.majorTag = major;
    }

    return packages;
  }

  async #resolveVersion(
    ctx: Context,
    name: string,
    versionInfo: PackageInstallInfo['versions'][string],
  ): Promise<PackageVersion> {
    // Блокируем асинхронные запросы к одному и тому же ресурсу
    using cache = await this.#resolveCache.acquire(`${name}@${versionInfo.version}`);

    const cachedResolvedPackage = cache.get();
    if (cachedResolvedPackage) {
      return cachedResolvedPackage;
    }

    const dependencies = await this.#resolveDependencies(ctx, {
      ...versionInfo.peerDependencies,
      ...versionInfo.dependencies,
    });

    const resolvedPackage: PackageVersion = {
      name,
      version: versionInfo.version,
      tarball: versionInfo.dist.tarball,
      dependencies,
      majorTag: null,
    };

    cache.set(resolvedPackage);

    return resolvedPackage;
  }

  async #resolveDependencies(
    ctx: Context,
    dependencies: Record<string, string>,
  ): Promise<PackageVersionDependency[]> {
    return await promiseRecordMap(dependencies, ([name, range]) =>
      this.#resolveMaxVersion(ctx, name, range),
    );
  }

  async #resolveMaxVersion(
    ctx: Context,
    name: string,
    range: string,
  ): Promise<PackageVersionDependency> {
    const packageInstallInfo = await this.repositories.npm.packageMetadata(
      await this.#registryContext(ctx),
      name,
    );

    const version = this.repositories.semver.maxSatisfying(
      Object.keys(packageInstallInfo.versions),
      range,
    );

    if (version === null || packageInstallInfo.versions[version] === undefined) {
      throw new Error(`package ${name}@${range} not resolved`);
    }

    return {
      name,
      version: packageInstallInfo.versions[version].version,
    };
  }
}
