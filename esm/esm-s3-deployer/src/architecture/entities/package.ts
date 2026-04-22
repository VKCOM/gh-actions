import * as z from 'zod';

const ExportConditions: z.ZodType<ExportConditions> = z.lazy(() => z.record(z.string(), Exports));

type ExportConditions = {
  [condition: string]: z.infer<typeof Exports>;
};

const Exports = z.union([
  z.null(),
  z.string(),
  z.array(z.union([z.string(), ExportConditions])),
  ExportConditions,
]);

const Imports = z.record(z.templateLiteral(['#', z.string()]), Exports);

const Dependency = z.record(z.string(), z.string());

export const PackageJson = z.looseObject({
  name: z.string().optional(),
  version: z.string().optional(),

  type: z.string().optional(),
  main: z.string().optional(),

  module: z.string().optional(),

  exports: Exports.optional(),
  imports: Imports.optional(),

  dependencies: Dependency.optional(),
  peerDependencies: Dependency.optional(),
});

export type PackageJson = z.infer<typeof PackageJson>;
