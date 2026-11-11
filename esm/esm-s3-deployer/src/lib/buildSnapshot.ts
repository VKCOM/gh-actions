import { createHash } from 'node:crypto';
import * as path from 'node:path/posix';
import { init, parse } from 'es-module-lexer';
import { dependencyGroups } from './dependencyGroups.ts';

export type BuildSnapshot = {
  files: ReadonlyMap<string, { immutableKey: string; immutable: Buffer; entry: Buffer }>;
};

export async function buildSnapshot(files: ReadonlyMap<string, Buffer>): Promise<BuildSnapshot> {
  await init;

  const sorted = [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const graph = new Map(sorted.map(([key]) => [key, new Set<string>()]));
  const modules = new Map<string, ReturnType<typeof parse>>();
  const directories = new Map<string, string[]>();

  function directory(key: string) {
    return key
      .split('/')
      .slice(0, key.startsWith('@') ? 2 : 1)
      .join('/');
  }

  function importFile(key: string, specifier: string) {
    if (!specifier.startsWith('/') && !specifier.startsWith('.')) return;

    const suffixIndex = specifier.search(/[?#]/);
    const pathname = suffixIndex === -1 ? specifier : specifier.slice(0, suffixIndex);
    const suffix = suffixIndex === -1 ? '' : specifier.slice(suffixIndex);
    const target = pathname.startsWith('/')
      ? pathname.slice(1)
      : path.join(path.dirname(key), pathname);

    if (!files.has(target)) {
      throw new Error(`Missing snapshot module ${specifier} imported by ${key}`);
    }

    return { target, suffix };
  }

  for (const [key, contents] of sorted) {
    const root = directory(key);
    const members = directories.get(root) ?? [];
    members.push(key);
    directories.set(root, members);

    if (!/\.m?js$/.test(key)) continue;

    const parsed = parse(contents.toString('utf8'));
    modules.set(key, parsed);

    for (const { n } of parsed[0]) {
      const dependency = n && importFile(key, n);
      if (dependency) graph.get(key)?.add(dependency.target);
    }
  }

  for (const [key, [imports]] of modules) {
    if (!imports.some(({ d, n }) => d === -2 || (d >= 0 && n === undefined))) continue;

    // Computed imports and import.meta may reference paths the lexer cannot
    // enumerate, including Rspack's publicPath for assets and workers. Keep that
    // package's output together so those relative paths still work.
    for (const member of directories.get(directory(key)) ?? []) {
      graph.get(key)?.add(member);
      graph.get(member)?.add(key);
    }
  }

  const immutableKeys = new Map<string, string>();

  for (const group of dependencyGroups(graph)) {
    const members = new Set(group);
    const hash = createHash('sha256').update('esm-s3-deployer:files-v2');

    for (const key of group.sort()) {
      const contents = files.get(key);
      if (!contents) throw new Error(`Missing snapshot file ${key}`);

      hash.update(JSON.stringify([key, contents.length])).update(contents);

      for (const dependency of [...(graph.get(key) ?? [])].sort()) {
        if (members.has(dependency)) continue;

        const target = immutableKeys.get(dependency);
        if (!target) throw new Error(`Unhashed snapshot dependency ${dependency}`);

        hash.update(JSON.stringify([dependency, target]));
      }
    }

    const prefix = `__builds/${hash.digest('hex')}`;
    for (const key of group) immutableKeys.set(key, `${prefix}/${key}`);
  }

  const snapshot: BuildSnapshot['files'] = new Map(
    sorted.map(([key, contents]) => {
      const immutableKey = immutableKeys.get(key);
      if (!immutableKey) throw new Error(`Unhashed snapshot file ${key}`);

      const parsed = modules.get(key);
      if (!parsed) return [key, { immutableKey, immutable: contents, entry: contents }];

      let code = contents.toString('utf8');
      const [imports, exports] = parsed;

      // Work backwards so replacing one specifier leaves earlier lexer offsets valid.
      for (const { n, s, e, d } of [...imports].reverse()) {
        const dependency = n && importFile(key, n);
        if (!dependency) continue;

        const target = JSON.stringify(
          `/${immutableKeys.get(dependency.target)}${dependency.suffix}`,
        );
        const start = d < 0 ? s - 1 : s;
        const end = d < 0 ? e + 1 : e;
        code = code.slice(0, start) + target + code.slice(end);
      }

      const url = JSON.stringify(`/${immutableKey}`);
      const hasDefault = exports.some(({ n }) => n === 'default');
      const entry = `export * from ${url};${hasDefault ? ` export { default } from ${url};` : ''}\n`;

      return [key, { immutableKey, immutable: Buffer.from(code), entry: Buffer.from(entry) }];
    }),
  );

  return { files: snapshot };
}
