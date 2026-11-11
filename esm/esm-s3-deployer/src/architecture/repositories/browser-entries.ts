import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageJson } from '../entities/package.ts';

export const browserImportConditions = ['browser', 'import', 'module', 'default'];
export const browserRequireConditions = ['browser', 'require', 'module', 'default'];

export function entryFilename(subpath: string): string {
  if (!subpath) return 'index.js';

  return /\.m?js$/.test(subpath) ? subpath : `${subpath}.js`;
}

// Only browser import conditions participate in selecting public JavaScript entries.
export function importTarget(
  value: unknown,
  conditions = browserImportConditions,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map((target) => importTarget(target, conditions)).find(Boolean);
  if (value && typeof value === 'object') {
    for (const [condition, target] of Object.entries(value)) {
      if (conditions.includes(condition)) {
        const selected = importTarget(target, conditions);
        if (selected !== undefined) return selected;
      }
    }
  }

  return undefined;
}

export function patternMatch(pattern: string, value: string): string | undefined {
  const parts = pattern.split('*');

  if (parts.length < 2) return undefined;

  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = `${escaped[0]}(.*)${escaped.slice(1).join('\\1')}`;

  return new RegExp(`^${expression}$`).exec(value)?.[1];
}

export function exportKey(exports: Record<string, unknown>, name: string): string | undefined {
  if (Object.hasOwn(exports, name)) return name;

  return Object.keys(exports)
    .filter((key) => patternMatch(key, name) !== undefined)
    .sort((a, b) => b.indexOf('*') - a.indexOf('*') || b.length - a.length)[0];
}

function exportSubpaths(pkg: PackageJson): Record<string, unknown> {
  const exports = pkg.exports;

  if (
    exports &&
    !Array.isArray(exports) &&
    typeof exports === 'object' &&
    Object.keys(exports).some((key) => key.startsWith('.'))
  ) {
    return exports;
  }

  return { '.': exports };
}

async function packageFiles(packagePath: string): Promise<string[]> {
  const files = await fs.readdir(packagePath, { recursive: true, withFileTypes: true });

  return files
    .filter((file) => file.isFile())
    .map((file) => {
      const relative = path.relative(packagePath, path.join(file.parentPath, file.name));

      return `./${relative.split(path.sep).join('/')}`;
    });
}

export async function publicEntries(
  packagePath: string,
  pkg: PackageJson,
  requested: ReadonlyArray<string>,
  resolveEntry: (request: string) => Promise<string | false>,
  includeAllEntries = true,
): Promise<Map<string, Set<string>>> {
  if (!pkg.name) throw new Error('Cannot build a package without a name');

  const entries = new Map<string, Set<string>>();

  function add(name: string) {
    const filename = entryFilename(name);
    const request = name ? `${pkg.name}/${name}` : `${pkg.name}`;
    const requests = entries.get(filename) ?? new Set<string>();
    requests.add(request);
    entries.set(filename, requests);
  }

  if (includeAllEntries && pkg.exports === undefined) {
    const resolved = await resolveEntry(pkg.name).catch(async (error: unknown) => {
      // Missing implicit index.js is valid for static-only packages. Explicit
      // entry declarations and existing entry files must still report errors.
      if (pkg.main || pkg.module || typeof Reflect.get(pkg, 'browser') === 'string') throw error;
      const files = await packageFiles(packagePath);
      if (files.some((file) => /^\.\/index\.(?:[cm]?js|json|node)$/.test(file))) throw error;
      return undefined;
    });
    if (resolved === false || (resolved && /\.[cm]?jsx?$/.test(resolved))) add('');
  }

  const subpaths = includeAllEntries && pkg.exports !== undefined ? exportSubpaths(pkg) : {};
  let files: string[] | undefined;

  for (const [subpath, value] of Object.entries(subpaths)) {
    const target = importTarget(value);
    if (!target || target.endsWith('/') || (path.extname(target) && !/\.[cm]?jsx?$/.test(target)))
      continue;
    if (subpath !== '.' && !subpath.startsWith('./')) continue;

    const name = subpath === '.' ? '' : subpath.slice(2);
    if (target.includes('*') && name.includes('*')) {
      files ??= await packageFiles(packagePath);

      for (const file of files) {
        if (!/\.[cm]?jsx?$/.test(file)) continue;

        const match = patternMatch(target, file);

        if (match === undefined) continue;

        const expanded = name.replaceAll('*', match);
        if (exportKey(subpaths, `./${expanded}`) === subpath) add(expanded);
      }
    } else if (!name.includes('*')) {
      add(name);
    }
  }

  for (const subpath of requested) add(subpath);

  return entries;
}
