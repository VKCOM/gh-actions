import { Configuration, type ConfigurationPartial } from '../entities/config.ts';
import type { Context } from '../entities/context.ts';
import type { Repositories } from '../entities/repositories.ts';
import {
  ConfigurationCache,
  ConfigurationFromObject,
  ConfigurationTesting,
} from './configuration.ts';
import { FS } from './fs.ts';
import { Mime } from './mime.ts';
import { Npm, NpmCache } from './npm.ts';
import { Package } from './package.ts';
import { S3, S3Console } from './s3.ts';
import { Semver } from './semver.ts';
import { Unpack } from './unpack.ts';

export async function halfProductionRepository(ctx: Context) {
  const configuration = new ConfigurationCache(new ConfigurationTesting());

  const cfg = await configuration.get(ctx);

  return {
    npm: new NpmCache(new Npm(cfg.registry.server)),
    fs: new FS(),
    unpack: new Unpack(),
    s3: new S3Console(),
    package: new Package(),
    configuration,
    mime: new Mime(),
    semver: new Semver(),
  } satisfies Repositories;
}

export async function libRepository(_ctx: Context, cfg: ConfigurationPartial) {
  const parsed = Configuration.parse(cfg);
  const configuration = new ConfigurationCache(new ConfigurationFromObject(parsed));

  return {
    npm: new NpmCache(new Npm(parsed.registry.server)),
    fs: new FS(),
    unpack: new Unpack(),
    s3: new S3(parsed.s3.bucket, parsed.s3.profile),
    package: new Package(),
    configuration: configuration,
    mime: new Mime(),
    semver: new Semver(),
  } satisfies Repositories;
}
