import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Compiler, rspack } from '@rspack/core';
import { init, parse } from 'es-module-lexer';
import type { Context } from '../entities/context.ts';
import type {
  BuildImport,
  BuildOptions,
  BuildPackage,
  BuildRepository,
} from '../entities/repositories.ts';
import {
  browserImportConditions,
  browserRequireConditions,
  entryFilename,
  exportKey,
  importTarget,
  patternMatch,
  publicEntries,
} from './browser-entries.ts';

const requireDirectory = '__require/';

type BuildSource = {
  options: BuildPackage;
  sourcePath: string;
  workspacePath: string;
  modulesPath: string;
  prefix: string;
  entries: Map<string, Set<string>>;
  requireEntries: Map<string, Set<string>>;
  emittedFiles: Set<string>;
};

function contains(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);

  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function prepareEntries(
  compiler: Compiler,
  sources: ReadonlyArray<BuildSource>,
): Promise<Record<string, string>> {
  await init;

  const entry: Record<string, string> = {};

  for (const source of sources) {
    for (const commonjs of [false, true]) {
      const entries = commonjs ? source.requireEntries : source.entries;

      for (const [index, [filename, requests]] of [...entries].entries()) {
        const [request, ...aliases] = requests;

        if (!request) continue;

        const resolver = compiler.resolverFactory.get('normal', {
          dependencyType: commonjs ? 'commonjs' : 'esm',
          conditionNames: commonjs ? browserRequireConditions : browserImportConditions,
          modules: [source.modulesPath],
        });
        const result = await new Promise<{ resolved: string | false; moduleType: unknown }>(
          (resolve, reject) => {
            resolver.resolve({}, source.workspacePath, request, {}, (error, resolved, details) => {
              if (error) return reject(error);
              if (resolved === undefined) return reject(new Error(`Cannot resolve ${request}`));

              const { type: moduleType } = details?.descriptionFileData ?? {};

              resolve({ resolved, moduleType });
            });
          },
        ).catch((error: unknown) => {
          if (commonjs && source.options.requireSubpaths === undefined) return undefined;

          throw error;
        });

        // An exports map may expose an entry for only one dependency type.
        if (!result) continue;

        const { resolved, moduleType } = result;

        for (const alias of aliases) {
          if (resolver.resolveSync({}, source.workspacePath, alias) !== resolved) {
            throw new Error(`Conflicting browser entries for ${filename}: ${request} and ${alias}`);
          }
        }

        const file = `${commonjs ? requireDirectory : ''}${filename}`;
        const outputFilename = `${source.prefix}${file}`;
        if (Object.hasOwn(entry, outputFilename)) {
          throw new Error(`Conflicting browser entries for ${filename}`);
        }

        const specifier = JSON.stringify(resolved === false ? request : resolved);
        const parsed = resolved === false ? undefined : parse(await fs.readFile(resolved, 'utf8'));
        const isModule =
          (parsed?.[3] ?? false) ||
          (resolved !== false &&
            (resolved.endsWith('.mjs') || (resolved.endsWith('.js') && moduleType === 'module')));
        const wrapper = path.join(
          source.workspacePath,
          commonjs ? `require-entry-${index}.js` : `entry-${index}.mjs`,
        );
        const importCode = isModule
          ? `export * from ${specifier};${parsed?.[1].some(({ n }) => n === 'default') ? ` export { default } from ${specifier};` : ''}`
          : `export * from ${specifier}; import value from ${specifier}; export default value;`;
        let code: string;
        if (commonjs) {
          // require(ESM) returns a namespace; require(CJS) returns module.exports.
          code = isModule
            ? `import * as value from ${specifier}; export default value;`
            : `const value = require(${specifier}); export default value;`;
        } else {
          code = importCode;
        }

        await fs.writeFile(wrapper, code);
        entry[outputFilename] = wrapper;
        source.emittedFiles.add(file);

        if (commonjs && !source.entries.has(filename)) {
          // Keep ordinary ESM URLs for required CommonJS modules when both
          // dependency types select the same implementation. Do not compile
          // an otherwise unused import branch of a conditional exports map.
          const importResolver = compiler.resolverFactory.get('normal', {
            dependencyType: 'esm',
            conditionNames: browserImportConditions,
            modules: [source.modulesPath],
          });
          let sameTarget = false;

          try {
            sameTarget = [...requests].every(
              (alias) => importResolver.resolveSync({}, source.workspacePath, alias) === resolved,
            );
          } catch {
            // A require-only export has no public browser import entry.
          }

          if (sameTarget) {
            const publicFilename = `${source.prefix}${filename}`;
            if (Object.hasOwn(entry, publicFilename)) {
              throw new Error(`Conflicting browser entries for ${filename}`);
            }

            const importWrapper = path.join(
              source.workspacePath,
              `import-require-entry-${index}.mjs`,
            );
            await fs.writeFile(importWrapper, importCode);

            entry[publicFilename] = importWrapper;
            source.emittedFiles.add(filename);
          }
        }
      }
    }
  }

  return entry;
}

function runCompiler(compiler: Compiler): Promise<void> {
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error) return reject(error);
      if (!stats || stats.hasErrors()) {
        return reject(new Error(stats?.toString({ all: false, errors: true }) ?? 'No build stats'));
      }
      resolve();
    });
  });
}

function closeCompiler(compiler: Compiler): Promise<void> {
  return new Promise((resolve, reject) =>
    compiler.close((error) => (error ? reject(error) : resolve())),
  );
}

export class Build implements BuildRepository {
  async build(ctx: Context, options: BuildOptions): Promise<ReadonlyArray<BuildImport>> {
    ctx.signal.throwIfAborted();

    await using workspace = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'esm-rspack-'));
    const workspaceRoot = await fs.realpath(workspace.path);
    const sources: BuildSource[] = [];

    for (const [index, pkg] of [options, ...(options.bundledPackages ?? [])].entries()) {
      if (!pkg.packageJson.name) throw new Error('Cannot build a package without a name');

      const workspacePath = path.join(workspaceRoot, `package-${index}`);
      const modulesPath = path.join(workspacePath, 'node_modules');
      // Rspack derives module IDs from paths relative to its context. Keep all
      // sources inside the workspace so random extraction paths cannot affect
      // emitted code, chunk hashes or immutable snapshot URLs.
      const sourcePath = path.join(workspacePath, 'source');
      await fs.cp(pkg.packagePath, sourcePath, { recursive: true });
      sources.push({
        options: pkg,
        sourcePath,
        workspacePath,
        modulesPath,
        prefix: index === 0 ? '' : `__bundled/${index}/`,
        emittedFiles: new Set(),
        entries: new Map(),
        requireEntries: new Map(),
      });
    }

    const root = sources[0];

    if (!root) throw new Error('No build sources');

    const defaultSource: BuildSource = root;

    function dependencySource(owner: BuildSource, name: string): BuildSource | undefined {
      if (owner.options.packageJson.name === name) return owner;

      const dependency = owner.options.dependencies.find((dependency) => dependency.name === name);

      if (!dependency) return;

      return sources.find(
        ({ options }) =>
          options.packageJson.name === name && options.packageJson.version === dependency.version,
      );
    }

    for (const source of sources) {
      const names = new Set([
        source.options.packageJson.name ?? '',
        ...source.options.dependencies.map(({ name }) => name),
      ]);

      for (const name of names) {
        const dependency = dependencySource(source, name);

        if (!dependency) continue;

        const link = path.join(source.modulesPath, name);
        await fs.mkdir(path.dirname(link), { recursive: true });
        await fs.symlink(dependency.sourcePath, link, 'dir');
      }
    }

    function ownerOf(context: string): BuildSource {
      return (
        sources.find(
          ({ sourcePath, workspacePath }) =>
            contains(sourcePath, context) || contains(workspacePath, context),
        ) ?? defaultSource
      );
    }

    function requestName(request: string): string {
      return request
        .split('/')
        .slice(0, request.startsWith('@') ? 2 : 1)
        .join('/');
    }

    function browserRequest(
      request: string,
      context: string,
      owner: BuildSource,
      commonjs: boolean,
    ): string | false {
      const { packageJson: pkg } = owner.options;
      const seen = new Set<string>();

      while (request.startsWith('#')) {
        if (seen.has(request)) throw new Error(`Circular package import ${request}`);

        seen.add(request);
        const key = exportKey(pkg.imports ?? {}, request);
        if (!key) break;

        const target = importTarget(
          pkg.imports?.[key as `#${string}`],
          commonjs ? browserRequireConditions : browserImportConditions,
        );
        if (!target) break;

        const match = patternMatch(key, request);
        request = match === undefined ? target : target.replaceAll('*', match);
        if (request.startsWith('.')) {
          request = path.resolve(owner.sourcePath, request);
          break;
        }
      }

      if (request.startsWith('#')) return request;
      const { browser } = pkg;

      if (browser && typeof browser === 'object' && !Array.isArray(browser)) {
        let key = request;

        if (request.startsWith('.') || path.isAbsolute(request)) {
          const browserKey = (file: string) =>
            `./${path.relative(owner.sourcePath, file).split(path.sep).join('/')}`;
          key = browserKey(path.resolve(context, request));

          if (
            !Object.hasOwn(browser, key) &&
            Object.keys(browser).some((key) => key.startsWith('.'))
          ) {
            // Resolve extensionless and directory imports before looking up file
            // aliases, without applying the browser replacement a second time.
            const resolver = compiler.resolverFactory.get('normal', {
              dependencyType: commonjs ? 'commonjs' : 'esm',
              aliasFields: [],
              modules: [owner.modulesPath],
            });

            try {
              const resolved = resolver.resolveSync({}, context, request);
              if (resolved !== false) key = browserKey(resolved);
            } catch {
              // Let the regular resolver report unresolved local imports.
            }
          }
        }

        const replacement = Object.hasOwn(browser, key) ? Reflect.get(browser, key) : undefined;

        if (replacement === false) return false;

        if (typeof replacement === 'string') {
          return replacement.startsWith('.')
            ? path.resolve(owner.sourcePath, replacement)
            : replacement;
        }
      }

      return request;
    }

    let entry: Record<string, string> = {};
    const imports = new Map<string, BuildImport>();

    function dependencyUrl(
      request: string,
      owner: BuildSource,
      commonjs: boolean,
    ): string | undefined {
      if (request.startsWith('.') || path.isAbsolute(request) || request.startsWith('#')) return;

      const name = requestName(request);

      if (dependencySource(owner, name)) return;

      const dependency = owner.options.dependencies.find((dependency) => dependency.name === name);

      if (!dependency) return;

      const subpath = request.slice(name.length).replace(/^\//, '');
      imports.set(`${owner.sourcePath}:${request}:${commonjs}`, {
        name,
        subpath,
        ...(commonjs && { commonjs: true as const }),
      });
      const url = `/${name}@${dependency.version}/${commonjs ? requireDirectory : ''}${entryFilename(subpath)}`;

      return url;
    }

    const compiler = rspack({
      mode: 'production',
      target: ['web', 'es2020'],
      context: root.workspacePath,
      entry: () => entry,
      output: {
        path: options.outputPath,
        filename: ({ chunk }) =>
          chunk?.name && Object.hasOwn(entry, chunk.name) ? '[name]' : 'chunks/[contenthash].js',
        chunkFilename: 'chunks/[contenthash].js',
        library: { type: 'modern-module' },
        module: true,
        publicPath: 'auto',
        clean: true,
      },
      resolve: {
        modules: [root.modulesPath],
        conditionNames: browserImportConditions,
        byDependency: { commonjs: { conditionNames: browserRequireConditions } },
        mainFields: ['browser', 'module', 'main'],
        aliasFields: ['browser'],
      },
      module: {
        parser: { javascript: { importMeta: false } },
        rules: sources.map((source) => ({
          include: (file: string) =>
            contains(source.sourcePath, file) || contains(source.workspacePath, file),
          resolve: { modules: [source.modulesPath] },
          use: [
            {
              loader: fileURLToPath(new URL('./runtime-assets-loader.cjs', import.meta.url)),
              options: { sourcePath: source.sourcePath, prefix: `${source.prefix}__assets/` },
            },
          ],
          test: /\.[cm]?jsx?$/,
        })),
      },
      externalsType: 'module',
      externals: [
        ({ request, context, dependencyType }, callback) => {
          const commonjs = dependencyType === 'commonjs';
          const directory = context ?? root.workspacePath;
          const owner = ownerOf(directory);
          const replacement = request && browserRequest(request, directory, owner, commonjs);
          const url = replacement ? dependencyUrl(replacement, owner, commonjs) : undefined;
          if (url) callback(null, commonjs ? [url, 'default'] : url);
          else callback();
        },
      ],
      optimization: {
        minimize: true,
        runtimeChunk: 'single',
        splitChunks: { chunks: 'all', minSize: 0 },
      },
      performance: false,
      devtool: false,
    });

    try {
      for (const source of sources) {
        const { options: pkg } = source;
        const resolver = compiler.resolverFactory.get('normal', {
          dependencyType: 'esm',
          conditionNames: browserImportConditions,
          modules: [source.modulesPath],
        });
        const resolveEntry = (request: string) =>
          new Promise<string | false>((resolve, reject) => {
            resolver.resolve({}, source.workspacePath, request, {}, (error, resolved) => {
              if (error) return reject(error);
              if (resolved === undefined) return reject(new Error(`Cannot resolve ${request}`));
              resolve(resolved);
            });
          });
        source.entries = await publicEntries(
          source.sourcePath,
          pkg.packageJson,
          pkg.subpaths ?? [],
          resolveEntry,
          pkg.includeAllEntries ?? true,
        );
        source.requireEntries =
          pkg.requireSubpaths === undefined
            ? source.entries
            : await publicEntries(
                source.sourcePath,
                pkg.packageJson,
                pkg.requireSubpaths,
                resolveEntry,
                false,
              );
      }

      if (
        sources.every(
          ({ entries, requireEntries }) => entries.size === 0 && requireEntries.size === 0,
        )
      )
        return [];

      entry = await prepareEntries(compiler, sources);
      await runCompiler(compiler);
      // Runtime URL arguments cannot be enumerated by the bundler. Preserve
      // archive assets at their source-relative paths alongside the URL bases.
      for (const source of sources) {
        await fs.cp(source.sourcePath, path.join(options.outputPath, source.prefix, '__assets'), {
          recursive: true,
          filter: (file) => !/\.[cm]?jsx?$/.test(file),
        });
      }
      ctx.signal.throwIfAborted();
    } finally {
      await closeCompiler(compiler);
    }

    // A cyclic group shares one compilation and CommonJS module cache. Other
    // members keep their public URLs through facades into the group's output.
    for (const source of sources.slice(1)) {
      if (!options.packageJson.version)
        throw new Error('Cannot bundle a package without a version');
      await fs.rm(source.options.outputPath, { recursive: true, force: true });

      for (const file of source.emittedFiles) {
        const target = `${source.prefix}${file}`;
        const code = await fs.readFile(path.join(options.outputPath, target), 'utf8');
        const hasDefault = parse(code)[1].some(({ n }) => n === 'default');
        const url = JSON.stringify(
          `/${options.packageJson.name}@${options.packageJson.version}/${target}`,
        );
        const facade = `export * from ${url};${hasDefault ? ` export { default } from ${url};` : ''}\n`;
        const destination = path.join(source.options.outputPath, file);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, facade);
      }
    }

    return [...imports.values()];
  }
}
