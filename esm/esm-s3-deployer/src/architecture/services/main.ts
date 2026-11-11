import * as path from 'node:path';
import * as pathPosix from 'node:path/posix';
import { Readable } from 'node:stream';
import { buildSnapshot } from '../../lib/buildSnapshot.ts';
import { generateCacheControl } from '../../lib/cache.ts';
import { chunk } from '../../lib/chunk.ts';
import { dependencyGroups } from '../../lib/dependencyGroups.ts';
import { difference } from '../../lib/difference.ts';
import { secondsInYear } from '../../lib/duration.ts';
import { type Context, contextWithTimeout } from '../entities/context.ts';
import type { PackageJson } from '../entities/package.ts';
import type { BuildPackage, Repositories } from '../entities/repositories.ts';
import { type PackageVersion, type PackageVersionDependency, RegistryService } from './registry.ts';
import { Service } from './service.ts';

const maxConcurrentUploadFiles = 4;
const maxDeleteFiles = 1000;
const immutableCacheControl = generateCacheControl({
  public: true,
  maxAge: secondsInYear,
  sMaxAge: secondsInYear,
  immutable: true,
});
const entryCacheControl = generateCacheControl({ public: true, noCache: true });

type PreparedPackage = {
  version: PackageVersion;
  packageJson: PackageJson;
  packagePath: string;
  buildPath: string;
  subpaths: Set<string>;
  requireSubpaths: Set<string>;
  browserEntries?: ReadonlyArray<string> | undefined;
};

function packageKey({ name, version }: PackageVersionDependency): string {
  return `${name}@${version}`;
}

function getPreparedPackage(
  packages: ReadonlyMap<string, PreparedPackage>,
  version: PackageVersionDependency,
): PreparedPackage {
  const key = packageKey(version);
  const prepared = packages.get(key);

  if (!prepared) throw new Error(`Unprepared dependency ${key}`);

  return prepared;
}

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

  async #uploadFile(ctx: Context, key: string, stream: Readable, cacheControl: string) {
    return await this.repositories.s3.upload(
      await this.#s3Context(ctx),
      stream,
      key,
      await this.repositories.mime.get(ctx, key),
      { CacheControl: cacheControl },
    );
  }

  async #uploadPackageFiles(
    ctx: Context,
    prepared: PreparedPackage,
    generated: ReadonlyMap<string, unknown>,
  ) {
    const prefix = packageKey(prepared.version);
    const files = (await this.repositories.package.fileList(ctx, prepared.packagePath)).filter(
      (file) => !generated.has(pathPosix.join(prefix, file)),
    );

    for (const fileChunk of chunk(files, maxConcurrentUploadFiles)) {
      await Promise.all(
        fileChunk.map((file) =>
          this.#uploadFile(
            ctx,
            pathPosix.join(prefix, file),
            this.repositories.fs.createReadStream(path.join(prepared.packagePath, file)),
            /\.m?js$/.test(file) ? entryCacheControl : immutableCacheControl,
          ),
        ),
      );
    }
  }

  async #copyS3Prefix(
    ctx: Context,
    srcPrefix: string,
    distPrefix: string,
    options: { CacheControl?: string } = {},
  ): Promise<string[]> {
    const objects = await this.repositories.s3.list(await this.#s3Context(ctx), srcPrefix);
    const copied: string[] = [];

    for (const key of objects) {
      const destKey = key.replace(srcPrefix, distPrefix);

      await this.repositories.s3.copy(await this.#s3Context(ctx), key, destKey, options);
      copied.push(destKey);
    }

    return copied;
  }

  async #copyToMajorTag(ctx: Context, version: PackageVersion) {
    const majorTagKeyPrefix = `${version.name}@${version.majorTag}/`;

    const listBefore = await this.repositories.s3.list(
      await this.#s3Context(ctx),
      majorTagKeyPrefix,
    );

    const copied = await this.#copyS3Prefix(ctx, `${packageKey(version)}/`, majorTagKeyPrefix, {
      CacheControl: entryCacheControl,
    });

    const diff = difference(listBefore, copied);
    if (diff.length === 0) return;

    for (const keys of chunk(diff, maxDeleteFiles)) {
      await this.repositories.s3.delete(await this.#s3Context(ctx), ...keys);
    }
  }

  async #preparePackageVersion(
    ctx: Context,
    version: PackageVersion,
    packages: Map<string, PreparedPackage>,
    resources: AsyncDisposableStack,
  ) {
    const key = packageKey(version);
    const existing = packages.get(key);

    if (existing) return existing;

    const tmpDir = resources.use(await this.repositories.fs.mkdtempDisposable());

    const packagePath = tmpDir.path;

    await this.repositories.unpack.downloadAndUnpack(ctx, version.tarball, packagePath);

    const packageJson = await this.repositories.package.packageJson(ctx, packagePath);

    const buildDir = resources.use(await this.repositories.fs.mkdtempDisposable());
    const prepared: PreparedPackage = {
      version,
      packageJson,
      packagePath,
      buildPath: buildDir.path,
      subpaths: new Set(),
      requireSubpaths: new Set(),
    };
    packages.set(key, prepared);

    for (const dependency of version.dependencies) {
      await this.#preparePackageRange(
        ctx,
        dependency.name,
        dependency.version,
        packages,
        resources,
      );
    }

    return prepared;
  }

  async #preparePackageRange(
    ctx: Context,
    name: string,
    range: string,
    packages: Map<string, PreparedPackage>,
    resources: AsyncDisposableStack,
  ): Promise<PreparedPackage[]> {
    const packageResolve = await this.#registry.resolve(ctx, name, range);

    const prepared: PreparedPackage[] = [];

    for (const version of packageResolve) {
      prepared.push(await this.#preparePackageVersion(ctx, version, packages, resources));
    }

    return prepared;
  }

  async #buildPackages(
    ctx: Context,
    packages: ReadonlyMap<string, PreparedPackage>,
    roots: ReadonlySet<PreparedPackage>,
  ) {
    // A new legacy subpath may import more subpaths, including from a dependency
    // already built for another consumer. Finish that graph before publishing.
    const graph = new Map<PreparedPackage, Set<PreparedPackage>>();
    const options = (prepared: PreparedPackage): BuildPackage => ({
      packagePath: prepared.packagePath,
      outputPath: prepared.buildPath,
      packageJson: prepared.packageJson,
      dependencies: prepared.version.dependencies,
      subpaths: [...new Set([...prepared.subpaths, ...(prepared.browserEntries ?? [])])].sort(),
      requireSubpaths: [...prepared.requireSubpaths].sort(),
      includeAllEntries: roots.has(prepared) && prepared.browserEntries === undefined,
    });
    const pending = new Set(roots);

    for (const prepared of pending) {
      pending.delete(prepared);
      const imports = await this.repositories.build.build(ctx, options(prepared));
      const dependencies = new Set<PreparedPackage>();
      graph.set(prepared, dependencies);

      for (const { name, subpath, commonjs } of imports) {
        const dependencyVersion = prepared.version.dependencies.find(
          (dependency) => dependency.name === name,
        );
        if (!dependencyVersion) throw new Error(`Unprepared dependency ${name}`);

        const dependency = getPreparedPackage(packages, dependencyVersion);

        dependencies.add(dependency);

        const subpaths = commonjs ? dependency.requireSubpaths : dependency.subpaths;

        if (subpaths.has(subpath)) continue;

        subpaths.add(subpath);
        pending.add(dependency);
      }
    }

    for (const group of dependencyGroups(graph)) {
      if (group.length < 2) continue;

      group.sort((a, b) => packageKey(a.version).localeCompare(packageKey(b.version)));
      const [first, ...rest] = group;

      if (!first) continue;

      await this.repositories.build.build(ctx, {
        ...options(first),
        bundledPackages: rest.map(options),
      });
    }

    return graph;
  }

  async #publishPackages(
    ctx: Context,
    graph: ReadonlyMap<PreparedPackage, ReadonlySet<PreparedPackage>>,
  ) {
    const files = new Map<string, Buffer>();

    for (const prepared of graph.keys()) {
      for (const file of await this.repositories.package.fileList(ctx, prepared.buildPath)) {
        files.set(
          pathPosix.join(packageKey(prepared.version), file),
          await this.repositories.fs.readFile(ctx, path.join(prepared.buildPath, file)),
        );
      }
    }

    const snapshot = await buildSnapshot(files);

    // Finish the entire immutable graph before switching any stable entry URL.
    for (const fileChunk of chunk([...snapshot.files], maxConcurrentUploadFiles)) {
      await Promise.all(
        fileChunk.map(([, { immutableKey, immutable }]) =>
          this.#uploadFile(ctx, immutableKey, Readable.from([immutable]), immutableCacheControl),
        ),
      );
    }

    for (const prepared of graph.keys()) {
      using logger = loggerTask(packageKey(prepared.version));
      logger.log('upload package files');
      await this.#uploadPackageFiles(ctx, prepared, snapshot.files);
    }

    for (const fileChunk of chunk([...snapshot.files], maxConcurrentUploadFiles)) {
      await Promise.all(
        fileChunk.map(([key, { entry }]) =>
          this.#uploadFile(ctx, key, Readable.from([entry]), entryCacheControl),
        ),
      );
    }
  }

  async run(ctx: Context) {
    await using resources = new AsyncDisposableStack();
    const packages = new Map<string, PreparedPackage>();
    const roots = new Set<PreparedPackage>();
    const configuration = await this.repositories.configuration.get(ctx);
    const configured = new Map(Object.entries(configuration.packages));

    for (const [packageName, range] of configured) {
      for (const prepared of await this.#preparePackageRange(
        ctx,
        packageName,
        range,
        packages,
        resources,
      )) {
        prepared.browserEntries = configuration.browserEntries[packageName];
        roots.add(prepared);
      }
    }

    const graph = await this.#buildPackages(ctx, packages, roots);

    await this.#publishPackages(ctx, graph);

    const aliases = new Map<string, PackageVersion>();

    for (const { version } of graph.keys()) {
      if (!version.majorTag) continue;

      const key = `${version.name}@${version.majorTag}`;
      const previous = aliases.get(key);

      if (
        !previous ||
        this.repositories.semver
          .latestByMajor([previous.version, version.version])
          .get(version.majorTag) === version.version
      ) {
        aliases.set(key, version);
      }
    }

    for (const version of aliases.values()) await this.#copyToMajorTag(ctx, version);
  }
}
