import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test } from 'node:test';
import { createContext, type Module, SourceTextModule } from 'node:vm';
import { Configuration } from '../entities/config.ts';
import type { Context } from '../entities/context.ts';
import type { PackageJson } from '../entities/package.ts';
import type { Repositories, S3Options } from '../entities/repositories.ts';
import { halfProductionRepository } from '../repositories/repositories.ts';
import { MainService } from './main.ts';

type FixturePackage = {
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  packageJson?: Partial<PackageJson>;
};

function browserLoader(uploads: ReadonlyArray<{ key: string; body: string }>) {
  const cdn = new Map(uploads.map(({ key, body }) => [`/${key}`, body]));
  const context = createContext({ URL });
  const modules = new Map<string, SourceTextModule>();

  function load(url: string): SourceTextModule {
    const cached = modules.get(url);
    if (cached) return cached;

    const code = cdn.get(url);

    assert.notEqual(code, undefined, `Missing browser module ${url}`);
    const module = new SourceTextModule(code ?? '', {
      context,
      identifier: url,
      initializeImportMeta(meta) {
        meta.url = `https://cdn.test${url}`;
      },
      async importModuleDynamically(specifier, parent) {
        const dependency = link(specifier, parent);
        if (dependency.status === 'unlinked') await dependency.link(link);
        await dependency.evaluate();
        return dependency;
      },
    });
    modules.set(url, module);

    return module;
  }

  function link(specifier: string, parent: Module) {
    return load(new URL(specifier, `https://cdn.test${parent.identifier}`).pathname);
  }

  return async (url: string) => {
    const root = load(url);
    if (root.status === 'unlinked') {
      await root.link(link);
    }

    await root.evaluate();

    return root.namespace;
  };
}

async function fixture(
  ctx: Context,
  packages: Record<string, FixturePackage>,
  roots: string[],
  browserEntries: Record<string, string[]> = {},
) {
  const uploads: Array<{ key: string; body: string; options: S3Options | undefined }> = [];
  const builds: string[] = [];
  const base = await halfProductionRepository(ctx);
  const repositories: Repositories = {
    ...base,
    configuration: {
      async get() {
        return Configuration.parse({
          packages: Object.fromEntries(roots.map((name) => [name, '1.0.0'])),
          browserEntries,
          s3: { bucket: 'unused' },
        });
      },
    },
    npm: {
      async packageMetadata(_ctx, name) {
        const pkg = packages[name];

        assert.ok(pkg, `Unexpected package ${name}`);
        const version = pkg.packageJson?.version ?? '1.0.0';

        return {
          name,
          modified: '',
          'dist-tags': {},
          versions: {
            [version]: {
              name,
              version,
              dependencies: pkg.dependencies ?? {},
              dist: { tarball: name, shasum: '' },
            },
          },
        };
      },
    },
    unpack: {
      async downloadAndUnpack(_ctx, name, destination) {
        const pkg = packages[name];

        assert.ok(pkg);
        const files = {
          ...pkg.files,
          'package.json': JSON.stringify({
            name,
            version: '1.0.0',
            main: 'index.js',
            dependencies: pkg.dependencies,
            ...pkg.packageJson,
          }),
        };

        for (const [file, body] of Object.entries(files)) {
          const target = path.join(destination, file);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, body);
        }
      },
    },
    build: {
      async build(ctx, options) {
        assert.equal(uploads.length, 0, 'Publication must wait for the complete build graph');
        builds.push(options.packageJson.name ?? '');

        return base.build.build(ctx, options);
      },
    },
    s3: {
      async upload(_ctx, stream, key, _contentType, options) {
        let body = '';

        for await (const chunk of stream) body += chunk;
        uploads.push({ key, body, options });
      },
      async list() {
        return [];
      },
      async copy() {},
      async delete() {},
    },
  };

  return { repositories, uploads, builds };
}

test('publishes a complete immutable snapshot before updating shared legacy entries', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads, builds } = await fixture(
    ctx,
    {
      app: {
        dependencies: { legacy: '1.0.0' },
        files: {
          'index.js':
            'export {value} from "legacy/feature"; export {default as nested} from "legacy/nested";',
        },
      },
      later: {
        dependencies: { bridge: '1.0.0' },
        files: { 'index.js': 'export {second} from "bridge";' },
      },
      bridge: {
        dependencies: { legacy: '1.0.0' },
        files: { 'index.js': 'export {second} from "legacy/extra";' },
      },
      legacy: {
        dependencies: { helper: '1.0.0' },
        files: {
          'index.js': 'export const root = 1;',
          'feature.js': 'exports.value = require("helper/first").value;',
          'extra.js': 'export {second} from "helper/second";',
          'nested/index.js': 'module.exports = function nested() { return 7; };',
        },
      },
      helper: {
        files: {
          'index.js': 'export const root = 0;',
          'first.js': 'export const value = 42;',
          'second.js': 'export const second = 100;',
        },
      },
    },
    ['app', 'later'],
  );

  await new MainService(repositories).run(ctx);

  assert.equal(new Set(uploads.map(({ key }) => key)).size, uploads.length);
  const firstEntry = uploads.findIndex(({ options }) =>
    options?.CacheControl?.includes('no-cache'),
  );
  const lastSnapshot = uploads.findLastIndex(({ key }) => key.startsWith('__builds/'));

  assert.ok(lastSnapshot >= 0 && firstEntry > lastSnapshot);
  assert.ok(builds.filter((name) => name === 'legacy').length > 1);
  assert.ok(builds.filter((name) => name === 'helper').length > 1);
  const generatedKeys = new Set(
    uploads
      .filter(({ key }) => key.startsWith('__builds/'))
      .map(({ key }) => key.split('/').slice(2).join('/')),
  );

  for (const { key, options } of uploads) {
    const isEntry = generatedKeys.has(key) || (!key.startsWith('__builds/') && /\.m?js$/.test(key));

    assert.ok(options?.CacheControl?.includes(isEntry ? 'no-cache' : 'immutable'), key);
  }

  const load = browserLoader(uploads);
  const app = await load('/app@1.0.0/index.js');

  assert.equal(Reflect.get(app, 'value'), 42);
  assert.equal(Reflect.get(app, 'nested')(), 7);
  assert.equal(Reflect.get(await load('/later@1.0.0/index.js'), 'second'), 100);
});

test('publishes static-only packages alongside JavaScript packages', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      styles: {
        packageJson: { main: undefined },
        files: { 'style.css': 'body { color: red; }', 'font.woff2': 'font bytes' },
      },
      app: { files: { 'index.js': 'export default 42;' } },
    },
    ['styles', 'app'],
  );

  await new MainService(repositories).run(ctx);

  assert.equal(
    uploads.find(({ key }) => key === 'styles@1.0.0/style.css')?.body,
    'body { color: red; }',
  );
  assert.equal(uploads.find(({ key }) => key === 'styles@1.0.0/font.woff2')?.body, 'font bytes');
  assert.equal(Reflect.get(await browserLoader(uploads)('/app@1.0.0/index.js'), 'default'), 42);
});

test('selects browser root entries without compiling Node-only exports', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        packageJson: {
          exports: {
            '.': './index.js',
            './client': './client.js',
            './server.node': './server.cjs',
            './static.node': { default: './server.cjs' },
          },
        },
        files: {
          'index.js': 'export default 42;',
          'client.js': 'export const client = true;',
          'server.cjs': 'module.exports = require("node:fs");',
        },
      },
    },
    ['app'],
    { app: ['', 'client'] },
  );

  await new MainService(repositories).run(ctx);

  const load = browserLoader(uploads);
  assert.equal(Reflect.get(await load('/app@1.0.0/index.js'), 'default'), 42);
  assert.equal(Reflect.get(await load('/app@1.0.0/client.js'), 'client'), true);
  assert.ok(
    !uploads.some(({ key }) => key.startsWith('__builds/') && key.endsWith('/server.node.js')),
  );
});

test('still rejects missing explicit entries before publication', async (t) => {
  for (const selected of [false, true]) {
    await t.test(selected ? 'selected subpath' : 'declared main', async () => {
      const ctx = { signal: t.signal };
      const { repositories, uploads } = await fixture(
        ctx,
        {
          styles: {
            packageJson: { main: selected ? undefined : 'missing.js' },
            files: { 'style.css': '' },
          },
        },
        ['styles'],
        selected ? { styles: ['missing'] } : {},
      );
      await assert.rejects(new MainService(repositories).run(ctx));
      assert.equal(uploads.length, 0);
    });
  }
});

test('preserves computed asset URLs relative to nested source modules across deploys', async (t) => {
  const ctx = { signal: t.signal };
  const urls: string[] = [];
  for (const bytes of ['first image', 'updated image']) {
    const { repositories, uploads } = await fixture(
      ctx,
      {
        app: {
          packageJson: { main: 'dist/index.js' },
          files: {
            'dist/index.js': 'export {asset} from "./nested/assets.js";',
            'dist/nested/assets.js':
              'const base = import.meta.url; export const asset = name => new URL(name, base).href;',
            'dist/nested/image.png': bytes,
            'dist/nested/style.css': 'body { background: url(image.png); }',
          },
        },
      },
      ['app'],
    );

    await new MainService(repositories).run(ctx);

    const namespace = await browserLoader(uploads)('/app@1.0.0/index.js');
    const image = new URL(Reflect.get(namespace, 'asset')('image.png'));
    assert.match(image.pathname, /^\/__builds\/[a-f0-9]{64}\//);
    assert.equal(uploads.find(({ key }) => `/${key}` === image.pathname)?.body, bytes);
    const style = new URL(Reflect.get(namespace, 'asset')('style.css'));
    assert.equal(
      uploads.find(({ key }) => `/${key}` === style.pathname)?.body,
      'body { background: url(image.png); }',
    );
    urls.push(image.href);
  }
  assert.notEqual(urls[0], urls[1], 'Changing an asset must change its immutable URL');
});

test('does not publish any package when a later build fails', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      working: { files: { 'index.js': 'export const value = 1;' } },
      broken: { files: { 'index.js': 'export {value} from "missing-dependency";' } },
    },
    ['working', 'broken'],
  );

  await assert.rejects(new MainService(repositories).run(ctx), /missing-dependency/);
  assert.deepEqual(uploads, []);
});

test('prepares cyclic package dependencies without repeating publication', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      first: {
        dependencies: { second: '1.0.0' },
        files: { 'index.js': 'export {second} from "second"; export const first = 1;' },
      },
      second: {
        dependencies: { first: '1.0.0' },
        files: { 'index.js': 'export {first} from "first"; export const second = 2;' },
      },
    },
    ['first'],
  );

  await new MainService(repositories).run(ctx);

  for (const name of ['first', 'second']) {
    assert.equal(uploads.filter(({ key }) => key === `${name}@1.0.0/index.js`).length, 1);
  }

  assert.equal(new Set(uploads.map(({ key }) => key)).size, uploads.length);

  const load = browserLoader(uploads);

  for (const name of ['first', 'second']) {
    const namespace = await load(`/${name}@1.0.0/index.js`);

    assert.deepEqual(Object.keys(namespace), ['first', 'second']);
    assert.equal(Reflect.get(namespace, 'first'), 1);
    assert.equal(Reflect.get(namespace, 'second'), 2);
  }
});

test('skips browser-disabled dependencies and their Node-only descendants', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads, builds } = await fixture(
    ctx,
    {
      app: {
        dependencies: { server: '1.0.0' },
        packageJson: { browser: { server: false } },
        files: { 'index.js': 'module.exports = Object.keys(require("server")).length;' },
      },
      server: {
        dependencies: { nested: '1.0.0' },
        files: { 'index.js': 'module.exports = require("nested");' },
      },
      nested: { files: { 'index.js': 'module.exports = require("node:fs");' } },
    },
    ['app'],
  );

  await new MainService(repositories).run(ctx);

  assert.deepEqual(builds, ['app']);
  assert.ok(uploads.every(({ key }) => key.includes('app@1.0.0/')));

  const namespace = await browserLoader(uploads)('/app@1.0.0/index.js');

  assert.equal(Reflect.get(namespace, 'default'), 0);
});

test('builds only imported dependency exports, leaving unused Node entries alone', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        dependencies: { dependency: '1.0.0' },
        files: { 'index.js': 'export {value} from "dependency/browser";' },
      },
      dependency: {
        packageJson: { exports: { '.': './node.js', './browser': './browser.js' } },
        files: {
          'node.js': 'module.exports = require("node:fs");',
          'browser.js': 'export const value = 42;',
        },
      },
    },
    ['app'],
  );

  await new MainService(repositories).run(ctx);

  const namespace = await browserLoader(uploads)('/app@1.0.0/index.js');

  assert.equal(Reflect.get(namespace, 'value'), 42);
});

test('executes CommonJS package cycles with shared partial exports and module identity', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      first: {
        dependencies: { second: '1.0.0' },
        files: {
          'index.js':
            'const second = require("second"); exports.first = 1; exports.readSecond = () => second;',
        },
      },
      second: {
        dependencies: { first: '1.0.0' },
        files: {
          'index.js':
            'const first = require("first"); exports.second = 2; exports.readFirst = () => first;',
        },
      },
    },
    ['first'],
  );

  await new MainService(repositories).run(ctx);

  const load = browserLoader(uploads);
  const first = Reflect.get(await load('/first@1.0.0/index.js'), 'default');
  const second = Reflect.get(await load('/second@1.0.0/index.js'), 'default');

  assert.equal(first.first, 1);
  assert.equal(second.second, 2);
  assert.equal(first.readSecond(), second);
  assert.equal(second.readFirst(), first);
  first.first = 42;

  assert.equal(second.readFirst().first, 42);
  assert.equal(new Set(uploads.map(({ key }) => key)).size, uploads.length);
});

test('updates a major alias from the latest published version only', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        dependencies: { shared: '1.0.0' },
        files: { 'index.js': 'export {value} from "shared";' },
      },
      shared: { files: { 'index.js': 'export const value = 42;' } },
    },
    ['app', 'shared'],
  );
  const copied: string[] = [];

  await new MainService({
    ...repositories,
    configuration: {
      async get(ctx) {
        const configuration = await repositories.configuration.get(ctx);

        return { ...configuration, packages: { app: '1.0.0', shared: '^1.0.0' } };
      },
    },
    npm: {
      async packageMetadata(ctx, name) {
        const metadata = await repositories.npm.packageMetadata(ctx, name);
        if (name !== 'shared') return metadata;

        const version = metadata.versions['1.0.0'];

        assert.ok(version);

        return {
          ...metadata,
          versions: { '1.1.0': { ...version, version: '1.1.0' }, ...metadata.versions },
        };
      },
    },
    s3: {
      ...repositories.s3,
      async list(_ctx, prefix) {
        return uploads.map(({ key }) => key).filter((key) => key.startsWith(prefix));
      },
      async copy(_ctx, from, to) {
        if (to.startsWith('shared@1/')) copied.push(from);
      },
    },
  }).run(ctx);

  assert.ok(copied.length > 0);
  assert.ok(
    copied.every((key) => key.startsWith('shared@1.1.0/')),
    copied.join('\n'),
  );
});

test('removes obsolete major alias files without copying adjacent version prefixes', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories } = await fixture(
    ctx,
    { app: { files: { 'index.js': 'export const value = 42;' } } },
    ['app'],
  );
  const obsolete = Array.from({ length: 1001 }, (_, i) => `app@1/stale-${i}.js`);
  const objects = new Set([...obsolete, 'app@10/keep.js', 'app@1.0.0-extra/keep.js']);
  const copied: string[] = [];
  const deleted: string[] = [];

  await new MainService({
    ...repositories,
    s3: {
      async upload(ctx, stream, key, contentType, options) {
        await repositories.s3.upload(ctx, stream, key, contentType, options);
        objects.add(key);
      },
      async list(_ctx, prefix) {
        return [...objects].filter((key) => key.startsWith(prefix));
      },
      async copy(_ctx, from, to) {
        copied.push(from);
        objects.add(to);
      },
      async delete(_ctx, ...keys) {
        assert.ok(keys.length <= 1000, 'S3 DeleteObjects accepts at most 1000 keys');
        deleted.push(...keys);

        for (const key of keys) objects.delete(key);
      },
    },
  }).run(ctx);

  assert.deepEqual(deleted, obsolete);
  assert.ok(objects.has('app@1/index.js'));
  assert.ok(objects.has('app@10/keep.js'));
  assert.ok(copied.every((key) => key.startsWith('app@1.0.0/')));
});

test('refreshes stable entries after a transitive dependency update and retains the old snapshot', async (t) => {
  const ctx = { signal: t.signal };
  type ObjectData = { key: string; body: string; options: S3Options | undefined };
  const objects = new Map<string, ObjectData>();
  const s3: Repositories['s3'] = {
    async upload(_ctx, stream, key, _type, options) {
      let body = '';

      for await (const chunk of stream) body += chunk;
      const previous = objects.get(key);
      if (previous?.options?.CacheControl?.includes('immutable')) {
        assert.equal(body, previous.body, `Immutable object was changed: ${key}`);
      }
      objects.set(key, { key, body, options });
    },
    async list(_ctx, prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
    async copy(_ctx, from, to, options) {
      const source = objects.get(from);

      assert.ok(source);
      objects.set(to, { ...source, key: to, options });
    },
    async delete(_ctx, ...keys) {
      for (const key of keys) {
        assert.ok(!key.startsWith('__builds/'), 'Old snapshots must remain available');
        objects.delete(key);
      }
    },
  };

  async function deploy(version: string, value: number) {
    const { repositories } = await fixture(
      ctx,
      {
        app: {
          dependencies: { bridge: '1.0.0' },
          packageJson: { exports: { '.': './index.js', './stable': './stable.js' } },
          files: {
            'index.js': 'export {value} from "bridge";',
            'stable.js': 'export const stable = 7;',
          },
        },
        bridge: {
          dependencies: { dependency: '^1.0.0' },
          files: { 'index.js': 'export {value} from "dependency";' },
        },
        dependency: {
          packageJson: { version },
          files: { 'index.js': `export const value = ${value};` },
        },
        unrelated: {
          files: { 'index.js': 'export default 100;' },
        },
      },
      ['app', 'unrelated'],
    );

    await new MainService({ ...repositories, s3 }).run(ctx);
  }

  await deploy('1.0.0', 1);
  const oldEntry = objects.get('app@1.0.0/index.js');
  const stableEntry = objects.get('app@1.0.0/stable.js');
  const unrelatedEntry = objects.get('unrelated@1.0.0/index.js');

  assert.ok(oldEntry && stableEntry && unrelatedEntry);
  const oldObjects = [...objects.values()].filter(({ key }) => key.startsWith('__builds/'));

  assert.equal(
    Reflect.get(await browserLoader([...objects.values()])('/app@1.0.0/index.js'), 'value'),
    1,
  );

  await deploy('1.0.1', 2);
  const entry = objects.get('app@1.0.0/index.js');

  assert.ok(entry);
  assert.notEqual(entry.body, oldEntry.body);
  assert.equal(entry.options?.CacheControl, 'no-cache, public');

  const load = browserLoader([...objects.values()]);

  assert.equal(Reflect.get(await load('/app@1.0.0/index.js'), 'value'), 2);
  assert.equal(Reflect.get(await load('/app@1/index.js'), 'value'), 2);
  assert.equal(objects.get('app@1/index.js')?.options?.CacheControl, 'no-cache, public');
  assert.deepEqual(objects.get('app@1.0.0/stable.js'), stableEntry);
  assert.deepEqual(objects.get('unrelated@1.0.0/index.js'), unrelatedEntry);

  for (const previous of oldObjects) {
    assert.deepEqual(objects.get(previous.key), previous);
  }

  const pinnedUrl = /"([^" ]+)"/.exec(oldEntry.body)?.[1];

  assert.ok(pinnedUrl);
  assert.ok(pinnedUrl.startsWith('/__builds/'));
  assert.equal(Reflect.get(await load(pinnedUrl), 'value'), 1);

  const beforeRepeat = new Map(objects);
  await deploy('1.0.1', 2);
  assert.deepEqual(objects, beforeRepeat, 'An unchanged deploy must reuse the same immutable URLs');
});

test('keeps stable entry URLs unchanged when uploading the immutable snapshot fails', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    { app: { files: { 'index.js': 'export default 42;' } } },
    ['app'],
  );

  await assert.rejects(
    new MainService({
      ...repositories,
      s3: {
        ...repositories.s3,
        async upload(ctx, stream, key, contentType, options) {
          if (key.endsWith('/index.js')) throw new Error('Snapshot upload failed');

          await repositories.s3.upload(ctx, stream, key, contentType, options);
        },
      },
    }).run(ctx),
    /Snapshot upload failed/,
  );

  assert.ok(uploads.every(({ key }) => key.startsWith('__builds/')));
});

test('revalidates raw JavaScript paths that may become generated entries on a later deploy', async (t) => {
  const ctx = { signal: t.signal };
  const objects = new Map<string, { body: string; options: S3Options | undefined }>();
  const s3: Repositories['s3'] = {
    async upload(_ctx, stream, key, _type, options) {
      let body = '';

      for await (const chunk of stream) body += chunk;
      const previous = objects.get(key);
      if (previous?.options?.CacheControl?.includes('immutable')) {
        assert.equal(body, previous.body, `Immutable object was changed: ${key}`);
      }
      objects.set(key, { body, options });
    },
    async list() {
      return [];
    },
    async copy() {},
    async delete() {},
  };

  async function deploy(feature: boolean) {
    const { repositories } = await fixture(
      ctx,
      {
        app: {
          dependencies: { dependency: '1.0.0' },
          files: { 'index.js': `export {value} from "dependency${feature ? '/feature' : ''}";` },
        },
        dependency: {
          files: {
            'index.js': 'export const value = 1;',
            'feature.js': 'export const value = 2;',
            'style.css': 'body { color: red; }',
          },
        },
      },
      ['app'],
    );

    await new MainService({ ...repositories, s3 }).run(ctx);
  }

  await deploy(false);

  assert.equal(
    objects.get('dependency@1.0.0/feature.js')?.options?.CacheControl,
    'no-cache, public',
  );

  assert.match(objects.get('dependency@1.0.0/style.css')?.options?.CacheControl ?? '', /immutable/);

  await deploy(true);
  const uploads = [...objects].map(([key, object]) => ({ key, ...object }));

  assert.equal(Reflect.get(await browserLoader(uploads)('/app@1.0.0/index.js'), 'value'), 2);

  await deploy(false);
});

test('preserves conditional dependency entries when bundling a package cycle', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      first: {
        dependencies: { second: '1.0.0' },
        files: {
          'index.js':
            'import second from "second"; export const value = 40; export const readImport = second; export const readRequire = require("second");',
        },
      },
      second: {
        dependencies: { first: '1.0.0' },
        packageJson: { exports: { '.': { import: './import.mjs', require: './require.cjs' } } },
        files: {
          'import.mjs': 'import {value} from "first"; export default () => value + 1;',
          'require.cjs': 'const first = require("first"); module.exports = () => first.value + 2;',
        },
      },
    },
    ['first'],
  );

  await new MainService(repositories).run(ctx);

  const namespace = await browserLoader(uploads)('/first@1.0.0/index.js');

  assert.equal(Reflect.get(namespace, 'readImport')(), 41);
  assert.equal(Reflect.get(namespace, 'readRequire')(), 42);
});

test('builds dependencies exposed only through require conditions', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        dependencies: { dependency: '1.0.0' },
        files: { 'index.js': 'module.exports = require("dependency");' },
      },
      dependency: {
        packageJson: { exports: { '.': { require: './index.cjs' } } },
        files: { 'index.cjs': 'module.exports = 42;' },
      },
    },
    ['app'],
  );

  await new MainService(repositories).run(ctx);

  assert.equal(Reflect.get(await browserLoader(uploads)('/app@1.0.0/index.js'), 'default'), 42);
});

test('does not publish when an import references a require-only dependency', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        dependencies: { dependency: '1.0.0' },
        files: { 'index.js': 'export {default} from "dependency";' },
      },
      dependency: {
        packageJson: { exports: { '.': { require: './index.cjs' } } },
        files: { 'index.cjs': 'module.exports = 42;' },
      },
    },
    ['app'],
  );

  await assert.rejects(new MainService(repositories).run(ctx));
  assert.deepEqual(uploads, []);
});

test('does not build unused Node-only import or require branches', async (t) => {
  for (const commonjs of [false, true]) {
    await t.test(commonjs ? 'require' : 'import', async () => {
      const ctx = { signal: t.signal };
      const { repositories, uploads } = await fixture(
        ctx,
        {
          app: {
            dependencies: { dependency: '1.0.0' },
            files: {
              'index.js': commonjs
                ? 'module.exports = require("dependency");'
                : 'export {default} from "dependency";',
            },
          },
          dependency: {
            packageJson: {
              exports: {
                '.': {
                  import: commonjs ? './node.cjs' : './browser.mjs',
                  require: commonjs ? './browser.cjs' : './node.cjs',
                },
              },
            },
            files: {
              'browser.mjs': 'export default 42;',
              'browser.cjs': 'module.exports = 42;',
              'node.cjs': 'module.exports = require("node:fs");',
            },
          },
        },
        ['app'],
      );

      await new MainService(repositories).run(ctx);

      assert.equal(Reflect.get(await browserLoader(uploads)('/app@1.0.0/index.js'), 'default'), 42);
    });
  }
});

test('publishes dependencies selected by browser file replacements', async (t) => {
  const ctx = { signal: t.signal };
  const { repositories, uploads } = await fixture(
    ctx,
    {
      app: {
        dependencies: { dependency: '1.0.0' },
        packageJson: { browser: { './server.js': 'dependency' } },
        files: {
          'index.js': 'export {default} from "./server.js";',
          'server.js': 'throw new Error("Server implementation must not be used");',
        },
      },
      dependency: {
        files: { 'index.js': 'module.exports = 42;' },
      },
    },
    ['app'],
  );

  await new MainService(repositories).run(ctx);

  assert.equal(Reflect.get(await browserLoader(uploads)('/app@1.0.0/index.js'), 'default'), 42);
});

test('loads hashed dynamic chunks and resolves emitted assets inside immutable output', async (t) => {
  for (const withAsset of [false, true]) {
    await t.test(withAsset ? 'with runtime assets' : 'with independent chunk hashes', async () => {
      const ctx = { signal: t.signal };
      const { repositories, uploads } = await fixture(
        ctx,
        {
          app: {
            files: {
              'index.js':
                'export const load = () => import("./lazy.js");' +
                (withAsset
                  ? 'export const image = new URL("./image.png", import.meta.url).href;'
                  : ''),
              'lazy.js': 'export const value = 42;',
              ...(withAsset && { 'image.png': 'image bytes' }),
            },
          },
        },
        ['app'],
      );

      await new MainService(repositories).run(ctx);

      const namespace = await browserLoader(uploads)('/app@1.0.0/index.js');
      assert.equal(Reflect.get(await Reflect.get(namespace, 'load')(), 'value'), 42);
      if (withAsset) {
        const image = new URL(Reflect.get(namespace, 'image'));
        assert.match(image.pathname, /^\/__builds\/[a-f0-9]{64}\//);
        assert.equal(uploads.find(({ key }) => `/${key}` === image.pathname)?.body, 'image bytes');
      } else {
        const hashes = new Set(
          uploads
            .filter(({ key }) => key.startsWith('__builds/'))
            .map(({ key }) => key.split('/')[1]),
        );
        assert.ok(hashes.size > 1);
      }
    });
  }
});
