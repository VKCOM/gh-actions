import type { DisposableTempDir } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import type { Configuration } from './config.ts';
import type { Context } from './context.ts';
import type { PackageInstallInfo } from './npm.ts';
import type { PackageJson } from './package.ts';

export interface NpmRepository {
  packageMetadata(ctx: Context, name: string): Promise<PackageInstallInfo>;
}

export interface FSRepository {
  createReadStream(filePath: string): Readable;
  mkdtempDisposable(): Promise<DisposableTempDir>;
}

export interface UnpackRepository {
  downloadAndUnpack(ctx: Context, url: string, destinationPath: string): Promise<void>;
}

export type S3Options = {
  CacheControl?: string | undefined;
};

export interface S3Repository {
  upload(
    ctx: Context,
    src: Readable,
    dist: string,
    contentType: string,
    options?: S3Options,
  ): Promise<void>;
  copy(ctx: Context, srcKey: string, distKey: string, options?: S3Options): Promise<void>;
  delete(ctx: Context, ...keys: string[]): Promise<void>;
  list(ctx: Context, prefix: string): Promise<string[]>;
}

export interface PackageRepository {
  packageJson(ctx: Context, packagePath: string): Promise<PackageJson>;
  fileList(ctx: Context, packagePath: string): Promise<string[]>;
}

export interface ConfigurationRepository {
  get(ctx: Context): Promise<Configuration>;
}

export interface MimeRepository {
  get(ctx: Context, path: string): Promise<string>;
}

export interface SemverRepository {
  maxSatisfying(versions: readonly string[], range: string): string | null;
  satisfies(version: string, range: string): boolean;
  major(version: string): string | null;
  latestByMajor(versions: readonly string[]): Map<string, string>;
}

export type Repositories = Readonly<{
  configuration: ConfigurationRepository;
  npm: NpmRepository;
  fs: FSRepository;
  unpack: UnpackRepository;
  s3: S3Repository;
  package: PackageRepository;
  mime: MimeRepository;
  semver: SemverRepository;
}>;
