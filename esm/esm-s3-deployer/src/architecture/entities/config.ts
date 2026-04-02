import * as z from 'zod';

// S3

const S3 = z.object({
  profile: z.string().optional(),
  bucket: z.string(),
});

// Timeout

const Timeout = z.object({
  registry: z.number().default(5000),
  s3: z.number().default(10000),
  fs: z.number().default(5000),
});

// Registry

const RegistryServer = z.string();

const Registry = z.object({
  server: RegistryServer.default('https://registry.npmjs.org'),
});

// Packages

const PackageName = z.string();
const VersionRange = z.string();

const Packages = z.record(PackageName, VersionRange);

// Configuration

export const Configuration = z.object({
  registry: Registry.default(Registry.parse({})),
  packages: Packages,
  timeout: Timeout.default(Timeout.parse({})),
  s3: S3,
});

export type Configuration = z.infer<typeof Configuration>;

const ConfigurationPartial = Configuration.partial();

export type ConfigurationPartial = z.infer<typeof ConfigurationPartial>;
