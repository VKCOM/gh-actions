import { z } from 'zod';

const DistTags = z.record(z.string(), z.string());

const Dependency = z.record(z.string(), z.string());

const Dist = z.looseObject({
  shasum: z.string(),
  tarball: z.string(),
  fileCount: z.number().optional(),
  integrity: z.string().optional(),
  signatures: z.array(z.looseObject({ sig: z.string(), keyid: z.string() })).optional(),
  attestations: z
    .looseObject({
      url: z.string(),
      provenance: z.looseObject({ predicateType: z.string() }),
    })
    .optional(),
  unpackedSize: z.number().optional(),
});

const Version = z.looseObject({
  name: z.string(),
  version: z.string(),
  dependencies: Dependency.optional(),
  peerDependencies: Dependency.optional(),
  dist: Dist,
});

const Versions = z.record(z.string(), Version);

export const PackageInstallInfo = z.looseObject({
  name: z.string(),
  'dist-tags': DistTags,
  versions: Versions,
  modified: z.string(),
});

export type PackageInstallInfo = z.infer<typeof PackageInstallInfo>;
