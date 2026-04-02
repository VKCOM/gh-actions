import * as path from 'node:path';
import * as pathPosix from 'node:path/posix';
import { generateCacheControl } from '../../lib/cache.ts';
import { chunk } from '../../lib/chunk.ts';
import { difference } from '../../lib/difference.ts';
import { secondsInHour, secondsInWeek, secondsInYear } from '../../lib/duration.ts';
import { type Context, contextWithTimeout } from '../entities/context.ts';
import type { Repositories } from '../entities/repositories.ts';
import { type PackageVersion, RegistryService } from './registry.ts';
import { Service } from './service.ts';

const maxConcurrentUploadFiles = 4;

function loggerTask(name: string) {
  console.log(`[${name}]: start`);

  return {
    log: (data: string) => console.log(`[${name}]:`, data),
    [Symbol.dispose]: () => {
      console.log(`[${name}]: finish`);
    },
  };
}

export class MainService extends Service {
  readonly #registry: RegistryService;

  constructor(repositories: Repositories) {
    super(repositories);

    this.#registry = new RegistryService(repositories);
  }

  async #s3Context(ctx: Context): Promise<Context> {
    const configuration = await this.repositories.configuration.get(ctx);

    return contextWithTimeout(ctx, configuration.timeout.s3);
  }

  async #uploadImmutableFile(ctx: Context, packagePath: string, prefix: string, file: string) {
    const filePath = path.join(packagePath, file);

    const contentType = await this.repositories.mime.get(ctx, filePath);

    const fileStream = this.repositories.fs.createReadStream(filePath);

    return await this.repositories.s3.upload(
      await this.#s3Context(ctx),
      fileStream,
      pathPosix.join(prefix, file),
      contentType,
      {
        CacheControl: generateCacheControl({
          public: true,
          maxAge: secondsInYear,
          sMaxAge: secondsInYear,
          immutable: true,
        }),
      },
    );
  }

  async #uploadAllImmutableFiles(ctx: Context, packagePath: string, name: string, version: string) {
    const fileList = await this.repositories.package.fileList(ctx, packagePath);

    const prefix = `${name}@${version}`;

    for (const fileChunk of chunk(fileList, maxConcurrentUploadFiles)) {
      await Promise.all(
        fileChunk.map(async (file) => {
          return await this.#uploadImmutableFile(ctx, packagePath, prefix, file);
        }),
      );
    }

    return;
  }

  async #copyS3Prefix(
    ctx: Context,
    srcPrefix: string,
    distPrefix: string,
    options: { CacheControl?: string } = {},
  ): Promise<void> {
    const objects = await this.repositories.s3.list(await this.#s3Context(ctx), srcPrefix);

    for (const key of objects) {
      const destKey = key.replace(srcPrefix, distPrefix);

      await this.repositories.s3.copy(await this.#s3Context(ctx), key, destKey, options);
    }

    return;
  }

  async #copyToMajorTag(ctx: Context, version: PackageVersion) {
    const majorTagKeyPrefix = `${version.name}@${version.majorTag}`;

    const listBefore = await this.repositories.s3.list(
      await this.#s3Context(ctx),
      majorTagKeyPrefix,
    );

    await this.#copyS3Prefix(ctx, `${version.name}@${version.version}`, majorTagKeyPrefix, {
      CacheControl: generateCacheControl({
        public: true,
        maxAge: secondsInWeek,
        sMaxAge: 12 * secondsInHour,
      }), // TODO: need configuration
    });

    const listAfter = await this.repositories.s3.list(
      await this.#s3Context(ctx),
      majorTagKeyPrefix,
    );

    const diff = difference(listBefore, listAfter);
    if (diff.length === 0) return;

    await this.repositories.s3.delete(await this.#s3Context(ctx), ...diff);
  }

  readonly #handledPackageVersion = new Set<string>();

  async #handlePackageVersion(ctx: Context, version: PackageVersion) {
    const key = `${version.name}@${version.version}`;
    if (this.#handledPackageVersion.has(key)) {
      return;
    }
    this.#handledPackageVersion.add(key);

    using logger = loggerTask(key);

    await Promise.all(
      version.dependencies.map((dependency) =>
        this.#handlePackageRange(ctx, dependency.name, dependency.version),
      ),
    );

    await using tmpDir = await this.repositories.fs.mkdtempDisposable();

    const packagePath = tmpDir.path;

    await this.repositories.unpack.downloadAndUnpack(ctx, version.tarball, packagePath);

    const packageJson = await this.repositories.package.packageJson(ctx, packagePath);

    if (packageJson.exports === undefined) {
      logger.log('upload all files');
      await this.#uploadAllImmutableFiles(ctx, packagePath, version.name, version.version);

      // TODO: handle module || main
      logger.log('need build main script');

      if (version.majorTag) {
        logger.log('copy major files');

        await this.#copyToMajorTag(ctx, version);
      }

      return;
    }

    // TODO: handle export
    logger.log('need build exports script');

    return;
  }

  async #handlePackageRange(ctx: Context, name: string, range: string): Promise<void> {
    const packageResolve = await this.#registry.resolve(ctx, name, range);

    for (const version of packageResolve) {
      await this.#handlePackageVersion(ctx, version);
    }

    return;
  }

  async #getPackagesFromConfiguration(ctx: Context) {
    const configuration = await this.repositories.configuration.get(ctx);

    return new Map<string, string>(Object.entries(configuration.packages));
  }

  async run(ctx: Context) {
    const packages = await this.#getPackagesFromConfiguration(ctx);

    for (const [packageName, range] of packages) {
      await this.#handlePackageRange(ctx, packageName, range);
    }
  }
}
