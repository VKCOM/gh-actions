import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { createContext, SourceTextModule } from 'node:vm';
import { buildSnapshot } from '../../lib/buildSnapshot.ts';
import { Build } from './build.ts';

async function fixture(files: Record<string, string>) {
  const directory = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'esm-build-test-'));

  for (const [name, content] of Object.entries(files)) {
    const file = path.join(directory.path, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }

  return directory;
}

function browserLoader(roots: Record<string, string>, globals: Record<string, unknown> = {}) {
  const context = createContext(globals);
  const modules = new Map<string, Promise<SourceTextModule>>();

  function load(url: string): Promise<SourceTextModule> {
    let pending = modules.get(url);
    if (!pending) {
      const root = Object.entries(roots).find(([prefix]) => url.startsWith(prefix));

      assert.ok(root, `Unexpected browser URL ${url}`);
      pending = fs.readFile(path.join(root[1], url.slice(root[0].length)), 'utf8').then(
        (code) =>
          new SourceTextModule(code, {
            context,
            identifier: url,
            initializeImportMeta(meta) {
              meta.url = `https://cdn.test${url}`;
            },
          }),
      );
      modules.set(url, pending);
    }

    return pending;
  }

  return async (url: string) => {
    const module = await load(url);
    if (module.status === 'unlinked') {
      await module.link((specifier, parent) => {
        assert.ok(specifier.startsWith('.') || specifier.startsWith('/'));

        return load(new URL(specifier, `https://cdn.test${parent.identifier}`).pathname);
      });
    }

    await module.evaluate();

    return module.namespace;
  };
}

test('builds browser exports, wildcard subpaths and versioned dependency imports', async (t) => {
  const pkg = {
    name: '@test/library',
    exports: {
      '.': { browser: './browser.js', default: './node.js' },
      './features/*': './features/*.js',
      './style.css': './style.css',
      './src/svg/': './src/svg/',
      './private': null,
    },
  };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'browser.js':
      'export { value } from "dependency/subpath"; export const environment = "browser";',
    'node.js': 'throw new Error("Wrong export condition");',
    'features/one.js': 'export default 42;',
    'style.css': 'body { color: red; }',
    'src/svg/add.svg': '<svg></svg>',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [{ name: 'dependency', version: '1.2.3' }],
    },
  );
  await using dependency = await fixture({ 'subpath.js': 'export const value = 7;' });

  const load = browserLoader({
    '/library@1.0.0/': output.path,
    '/dependency@1.2.3/': dependency.path,
  });

  const namespace = await load('/library@1.0.0/index.js');

  assert.equal(Reflect.get(namespace, 'environment'), 'browser');
  assert.equal(Reflect.get(namespace, 'value'), 7);
  const feature = await load('/library@1.0.0/features/one.js');

  assert.equal(Reflect.get(feature, 'default'), 42);
  await assert.rejects(fs.access(path.join(output.path, 'style.css.js')));
  await assert.rejects(fs.access(path.join(output.path, 'src/svg')));
});

test('builds module/main packages with bundled local imports and default exports', async (t) => {
  const pkg = { name: 'legacy-package', module: './esm.js', main: './cjs.cjs' };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'esm.js':
      'export { value as default } from "./value.js"; export const lazy = () => import("./lazy.js");',
    'lazy.js': 'export default 456;',
    'value.js': 'export const value = 123;',
    'cjs.cjs': 'throw new Error("Wrong entry");',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [],
    },
  );

  const module = await import(path.join(output.path, 'index.js'));

  assert.equal(module.default, 123);
  assert.equal((await module.lazy()).default, 456);
});

test('resolves legacy browser entries before filtering non-JavaScript files', async (t) => {
  const cases = [
    { main: 'lib/' },
    { module: 'lib/' },
    { main: 'index.json', browser: 'browser.js' },
    { main: 'index.json', browser: { './index.json': './browser.js' } },
    { main: 'index.json' },
  ];

  for (const entry of cases) {
    await t.test(JSON.stringify(entry), async () => {
      const pkg = { name: 'legacy-browser-package', ...entry };
      await using source = await fixture({
        'package.json': JSON.stringify(pkg),
        'lib/index.js': 'export default "directory";',
        'browser.js': 'export default "browser";',
        'index.json': '{"value": 42}',
      });
      await using output = await fixture({});
      await new Build().build(
        { signal: t.signal },
        { packagePath: source.path, outputPath: output.path, packageJson: pkg, dependencies: [] },
      );

      if (entry.main === 'index.json' && !entry.browser) {
        assert.deepEqual(await fs.readdir(output.path), []);
      } else {
        const load = browserLoader({ '/legacy@1.0.0/': output.path });
        const namespace = await load('/legacy@1.0.0/index.js');
        assert.equal(Reflect.get(namespace, 'default'), entry.browser ? 'browser' : 'directory');
      }
    });
  }
});

test('resolves computed asset URLs against the published module URL', async (t) => {
  const pkg = { name: 'runtime-url-package', main: './index.js' };
  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'index.js':
      'export const base = import.meta.url; export const asset = name => new URL(name, base).href;',
  });
  await using output = await fixture({});
  await new Build().build(
    { signal: t.signal },
    { packagePath: source.path, outputPath: output.path, packageJson: pkg, dependencies: [] },
  );

  const load = browserLoader({ '/runtime-url@1.0.0/': output.path }, { URL });
  const namespace = await load('/runtime-url@1.0.0/index.js');
  const base = Reflect.get(namespace, 'base');
  assert.match(base, /^https:\/\/cdn\.test\/runtime-url@1\.0\.0\//);
  assert.equal(Reflect.get(namespace, 'asset')('asset.svg'), new URL('asset.svg', base).href);
});

test('reuses immutable URLs when rebuilding identical packages from different directories', async (t) => {
  for (const commonjs of [true, false]) {
    await t.test(commonjs ? 'CommonJS' : 'ESM with dynamic chunks', async () => {
      const pkg = { name: 'repeatable-package', version: '1.0.0', main: './index.js' };
      const files = {
        'package.json': JSON.stringify(pkg),
        'index.js': commonjs
          ? 'const state = require("./state.js"); module.exports = () => state.value++;'
          : 'export { value } from "./state.js"; export const lazy = () => import("./lazy.js"); export const base = import.meta.url;',
        'state.js': commonjs ? 'exports.value = 42;' : 'export const value = 42;',
        'lazy.js': 'export default 123;',
      };

      async function compile() {
        await using source = await fixture(files);
        await using output = await fixture({});
        await new Build().build(
          { signal: t.signal },
          {
            packagePath: source.path,
            outputPath: output.path,
            packageJson: pkg,
            dependencies: [],
          },
        );

        const generated = new Map<string, Buffer>();
        const entries = await fs.readdir(output.path, { recursive: true, withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const file = path.join(entry.parentPath, entry.name);
          const relative = path.relative(output.path, file).split(path.sep).join('/');
          generated.set(`${pkg.name}@${pkg.version}/${relative}`, await fs.readFile(file));
        }

        return { generated, snapshot: await buildSnapshot(generated) };
      }

      const first = await compile();
      const second = await compile();
      assert.deepEqual(second.generated, first.generated);
      assert.deepEqual(second.snapshot, first.snapshot);
    });
  }
});

test('rejects unresolved imports and aborted builds', async (t) => {
  const pkg = { name: 'broken-package', main: './index.js' };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'index.js': 'export { value } from "missing-dependency";',
  });
  await using output = await fixture({});

  await assert.rejects(
    new Build().build(
      { signal: t.signal },
      {
        packagePath: source.path,
        outputPath: output.path,
        packageJson: pkg,
        dependencies: [],
      },
    ),
    /missing-dependency/,
  );

  await assert.rejects(
    new Build().build(
      { signal: AbortSignal.abort() },
      {
        packagePath: source.path,
        outputPath: output.path,
        packageJson: pkg,
        dependencies: [],
      },
    ),
    { name: 'AbortError' },
  );
});

test('preserves CommonJS defaults and named exports without adding an ESM default', async (t) => {
  for (const [name, source, expected] of [
    ['function.cjs', 'module.exports = function answer() { return 42; };', ['default']],
    ['object.cjs', 'module.exports = { value: 123 };', ['default']],
    ['named.cjs', 'exports.value = 123;', ['default', 'value']],
    ['module.mjs', 'export const value = 123;', ['value']],
  ] as const) {
    await t.test(name, async () => {
      const pkg = { name: 'commonjs-default', main: name };
      await using input = await fixture({ 'package.json': JSON.stringify(pkg), [name]: source });
      await using output = await fixture({});

      await new Build().build(
        { signal: t.signal },
        {
          packagePath: input.path,
          outputPath: output.path,
          packageJson: pkg,
          dependencies: [],
        },
      );

      const namespace = await browserLoader({ '/': output.path })('/index.js');

      assert.deepEqual(Object.keys(namespace), [...expected]);
      const value = Reflect.get(namespace, 'default');
      if (name === 'function.cjs') assert.equal(value(), 42);
      if (name === 'object.cjs' || name === 'named.cjs') assert.equal(value.value, 123);
    });
  }
});

test('expands nested wildcard paths and respects exact and pattern exclusions', async (t) => {
  const pkg = {
    name: 'wildcard-library',
    exports: {
      './features/*': './src/features/*.js',
      './features/private': null,
      './features/server': { browser: null, default: './src/features/server.js' },
      './features/internal/*': null,
      './features/special/*': './special/*.js',
    },
  };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'src/features/nested/two.js': 'export default 2;',
    'src/features/private.js': 'throw new Error("Private file");',
    'src/features/server.js': 'throw new Error("Server-only file");',
    'src/features/internal/secret.js': 'throw new Error("Private pattern");',
    'src/features/special/one.js': 'throw new Error("Shadowed target");',
    'special/one.js': 'export default 1;',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [],
    },
  );

  assert.equal((await import(path.join(output.path, 'features/nested/two.js'))).default, 2);
  assert.equal((await import(path.join(output.path, 'features/special/one.js'))).default, 1);
  await assert.rejects(fs.access(path.join(output.path, 'features/private.js')));
  await assert.rejects(fs.access(path.join(output.path, 'features/server.js')));
  await assert.rejects(fs.access(path.join(output.path, 'features/internal/secret.js')));
});

test('rejects browser filename collisions instead of replacing exports', async (t) => {
  const cases: Array<Record<string, string>> = [
    { '.': './one.js', './index': './two.js' },
    { './feature': './one.js', './feature.js': './two.js' },
    { './features/*': './*.js', './features/one.js': './two.js' },
  ];

  for (const exports of cases) {
    const pkg = { name: 'conflicting-exports', exports };

    await using source = await fixture({
      'package.json': JSON.stringify(pkg),
      'one.js': 'export default 1;',
      'two.js': 'export default 2;',
    });
    await using output = await fixture({});

    await assert.rejects(
      new Build().build(
        { signal: t.signal },
        {
          packagePath: source.path,
          outputPath: output.path,
          packageJson: pkg,
          dependencies: [],
        },
      ),
      /Conflicting browser entries/,
    );

    assert.deepEqual(await fs.readdir(output.path), []);
  }
});

test('allows colliding aliases when they resolve to the same module', async (t) => {
  const pkg = { name: 'export-aliases', exports: { '.': './one.js', './index': './one.js' } };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'one.js': 'export default 42;',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [],
      subpaths: ['index'],
    },
  );

  assert.equal((await import(path.join(output.path, 'index.js'))).default, 42);
});

test('filters non-JavaScript files after expanding unrestricted wildcard exports', async (t) => {
  const pkg = { name: 'mixed-wildcard', exports: { '.': './main.js', './*': './*' } };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'main.js': 'export const value = 42;',
    'nested/feature.cjs': 'module.exports = 7;',
    'README.md': '# Documentation',
    'style.css': 'body { color: red; }',
    'data.json': '{"value": 1}',
    'main.d.ts': 'export declare const value: number;',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [],
    },
  );

  const load = browserLoader({ '/': output.path });

  assert.equal(Reflect.get(await load('/index.js'), 'value'), 42);
  assert.equal(Reflect.get(await load('/nested/feature.cjs.js'), 'default'), 7);

  for (const file of ['package.json', 'README.md', 'style.css', 'data.json', 'main.d.ts']) {
    await assert.rejects(fs.access(path.join(output.path, `${file}.js`)));
  }
});

test('requires a callable CommonJS dependency through its browser ESM default', async (t) => {
  const dependency = { name: 'callable', main: 'index.cjs' };
  const consumer = { name: 'consumer', main: 'index.cjs' };

  await using dependencySource = await fixture({
    'package.json': JSON.stringify(dependency),
    'index.cjs': 'module.exports = function answer() { return 42; };',
  });
  await using consumerSource = await fixture({
    'package.json': JSON.stringify(consumer),
    'index.cjs': 'const answer = require("callable"); module.exports = answer();',
  });
  await using dependencyOutput = await fixture({});
  await using consumerOutput = await fixture({});
  const build = new Build();

  await build.build(
    { signal: t.signal },
    {
      packagePath: dependencySource.path,
      outputPath: dependencyOutput.path,
      packageJson: dependency,
      dependencies: [],
    },
  );
  const imports = await build.build(
    { signal: t.signal },
    {
      packagePath: consumerSource.path,
      outputPath: consumerOutput.path,
      packageJson: consumer,
      dependencies: [{ name: 'callable', version: '1.0.0' }],
    },
  );

  assert.deepEqual(imports, [{ name: 'callable', subpath: '', commonjs: true }]);

  const load = browserLoader({
    '/callable@1.0.0/': dependencyOutput.path,
    '/consumer@1.0.0/': consumerOutput.path,
  });

  assert.equal(Reflect.get(await load('/consumer@1.0.0/index.js'), 'default'), 42);
});

test('shares module identity and state across root, subpath and alias entries', async (t) => {
  const pkg = {
    name: 'shared-state',
    exports: { '.': './main.js', './state': './state.js', './alias': './state.js' },
  };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'main.js': 'export { state, Context } from "./state.js";',
    'state.js': 'export const state = { value: 0 }; export class Context {}',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    {
      packagePath: source.path,
      outputPath: output.path,
      packageJson: pkg,
      dependencies: [],
    },
  );

  const load = browserLoader({ '/': output.path });
  const root = await load('/index.js');
  const subpath = await load('/state.js');
  const alias = await load('/alias.js');
  const state = Reflect.get(root, 'state');
  state.value = 42;

  for (const namespace of [subpath, alias]) {
    assert.equal(Reflect.get(namespace, 'state'), state);
    assert.equal(Reflect.get(namespace, 'state').value, 42);
    assert.equal(Reflect.get(namespace, 'Context'), Reflect.get(root, 'Context'));
  }
});

test('applies browser dependency replacements before externalization', async (t) => {
  for (const format of ['esm', 'commonjs']) {
    for (const replacement of ['./browser.js', false, 'browser-dependency'] as const) {
      await t.test(`${format}: ${replacement}`, async () => {
        const pkg = {
          name: 'browser-alias',
          main: './src/index.js',
          browser: { 'node-dependency': replacement },
        };
        const expression = replacement === false ? 'Object.keys(value).length' : 'value';

        await using source = await fixture({
          'package.json': JSON.stringify(pkg),
          'src/index.js':
            format === 'esm'
              ? `import value from "node-dependency"; export default ${expression};`
              : `const value = require("node-dependency"); module.exports = ${expression};`,
          'browser.js': format === 'esm' ? 'export default 42;' : 'module.exports = 42;',
        });
        const dependency = { name: 'browser-dependency', main: './index.js' };

        await using dependencySource = await fixture({
          'package.json': JSON.stringify(dependency),
          'index.js': 'module.exports = 42;',
        });
        await using output = await fixture({});
        await using dependencyOutput = await fixture({});
        const build = new Build();

        await build.build(
          { signal: t.signal },
          {
            packagePath: dependencySource.path,
            outputPath: dependencyOutput.path,
            packageJson: dependency,
            dependencies: [],
          },
        );
        const imports = await build.build(
          { signal: t.signal },
          {
            packagePath: source.path,
            outputPath: output.path,
            packageJson: pkg,
            dependencies: [
              { name: 'node-dependency', version: '1.0.0' },
              { name: 'browser-dependency', version: '1.0.0' },
            ],
          },
        );

        assert.deepEqual(
          imports,
          replacement === 'browser-dependency'
            ? [
                {
                  name: 'browser-dependency',
                  subpath: '',
                  ...(format === 'commonjs' && { commonjs: true }),
                },
              ]
            : [],
        );

        const load = browserLoader({
          '/browser-alias@1.0.0/': output.path,
          '/browser-dependency@1.0.0/': dependencyOutput.path,
        });

        assert.equal(
          Reflect.get(await load('/browser-alias@1.0.0/index.js'), 'default'),
          replacement === false ? 0 : 42,
        );
      });
    }
  }
});

test('preserves both default and named exports when CommonJS requires ESM', async (t) => {
  const dependency = { name: 'esm-dependency', type: 'module', main: 'index.js' };
  const consumer = { name: 'consumer', main: 'index.cjs' };

  await using dependencySource = await fixture({
    'package.json': JSON.stringify(dependency),
    'index.js': 'export default function answer() { return 7; } export const value = 42;',
  });
  await using consumerSource = await fixture({
    'package.json': JSON.stringify(consumer),
    'index.cjs': 'const ns = require("esm-dependency"); module.exports = ns.value + ns.default();',
  });
  await using dependencyOutput = await fixture({});
  await using consumerOutput = await fixture({});
  const build = new Build();

  await build.build(
    { signal: t.signal },
    {
      packagePath: dependencySource.path,
      outputPath: dependencyOutput.path,
      packageJson: dependency,
      dependencies: [],
    },
  );

  await build.build(
    { signal: t.signal },
    {
      packagePath: consumerSource.path,
      outputPath: consumerOutput.path,
      packageJson: consumer,
      dependencies: [{ name: 'esm-dependency', version: '1.0.0' }],
    },
  );

  const load = browserLoader({
    '/esm-dependency@1.0.0/': dependencyOutput.path,
    '/consumer@1.0.0/': consumerOutput.path,
  });

  assert.equal(Reflect.get(await load('/consumer@1.0.0/index.js'), 'default'), 49);

  const namespace = await load('/esm-dependency@1.0.0/index.js');

  assert.deepEqual(Object.keys(namespace), ['default', 'value']);
});

test('resolves conditional, chained and wildcard package imports before externalization', async (t) => {
  for (const format of ['esm', 'commonjs']) {
    await t.test(format, async () => {
      const dependency = { name: 'dependency', exports: { './feature': './feature.js' } };
      const consumer = {
        name: 'consumer',
        main: 'index.js',
        imports: {
          '#features/*': { browser: 'dependency/*', default: 'node:fs' },
          '#answer': '#features/feature',
          '#local': './src/local.js',
        },
      };

      await using dependencySource = await fixture({
        'package.json': JSON.stringify(dependency),
        'feature.js': 'export const value = 40;',
      });
      await using consumerSource = await fixture({
        'package.json': JSON.stringify(consumer),
        'index.js':
          format === 'esm'
            ? 'import {value} from "#answer"; import local from "#local"; export default value + local;'
            : 'module.exports = require("#answer").value + require("#local");',
        'src/local.js': format === 'esm' ? 'export default 2;' : 'module.exports = 2;',
      });
      await using dependencyOutput = await fixture({});
      await using consumerOutput = await fixture({});
      const build = new Build();

      await build.build(
        { signal: t.signal },
        {
          packagePath: dependencySource.path,
          outputPath: dependencyOutput.path,
          packageJson: dependency,
          dependencies: [],
        },
      );
      const imports = await build.build(
        { signal: t.signal },
        {
          packagePath: consumerSource.path,
          outputPath: consumerOutput.path,
          packageJson: consumer,
          dependencies: [{ name: 'dependency', version: '1.0.0' }],
        },
      );

      assert.deepEqual(imports, [
        {
          name: 'dependency',
          subpath: 'feature',
          ...(format === 'commonjs' && { commonjs: true }),
        },
      ]);

      const load = browserLoader({
        '/dependency@1.0.0/': dependencyOutput.path,
        '/consumer@1.0.0/': consumerOutput.path,
      });

      assert.equal(Reflect.get(await load('/consumer@1.0.0/index.js'), 'default'), 42);
    });
  }
});

test('requires transpiled CommonJS with __esModule without unwrapping its default', async (t) => {
  const dependency = { name: 'transpiled', main: 'index.cjs' };
  const consumer = { name: 'consumer', main: 'index.cjs' };

  await using dependencySource = await fixture({
    'package.json': JSON.stringify(dependency),
    'index.cjs':
      'Object.defineProperty(exports, "__esModule", {value: true}); exports.default = () => 7; exports.value = 42;',
  });
  await using consumerSource = await fixture({
    'package.json': JSON.stringify(consumer),
    'index.cjs': 'const ns = require("transpiled"); module.exports = ns.value + ns.default();',
  });
  await using dependencyOutput = await fixture({});
  await using consumerOutput = await fixture({});
  const build = new Build();

  await build.build(
    { signal: t.signal },
    {
      packagePath: dependencySource.path,
      outputPath: dependencyOutput.path,
      packageJson: dependency,
      dependencies: [],
    },
  );

  await build.build(
    { signal: t.signal },
    {
      packagePath: consumerSource.path,
      outputPath: consumerOutput.path,
      packageJson: consumer,
      dependencies: [{ name: 'transpiled', version: '1.0.0' }],
    },
  );

  const load = browserLoader({
    '/transpiled@1.0.0/': dependencyOutput.path,
    '/consumer@1.0.0/': consumerOutput.path,
  });

  assert.equal(Reflect.get(await load('/consumer@1.0.0/index.js'), 'default'), 49);
});

test('builds side-effect-only ESM entries without inventing a default export', async (t) => {
  for (const pkg of [
    { name: 'side-effects', main: 'index.mjs' },
    { name: 'side-effects', type: 'module', main: 'index.js' },
  ]) {
    await using source = await fixture({
      'package.json': JSON.stringify(pkg),
      [pkg.main]: 'globalThis.executions = (globalThis.executions ?? 0) + 1;',
    });
    await using output = await fixture({});

    await new Build().build(
      { signal: t.signal },
      { packagePath: source.path, outputPath: output.path, packageJson: pkg, dependencies: [] },
    );
    const globals = { executions: 0 };

    const load = browserLoader({ '/': output.path }, globals);

    assert.deepEqual(Object.keys(await load('/index.js')), []);
    assert.deepEqual(Object.keys(Reflect.get(await load('/__require/index.js'), 'default')), []);
    assert.equal(globals.executions, 1);
  }
});

test('resolves import and require conditions independently for dependency entries', async (t) => {
  const dependency = {
    name: 'conditional',
    exports: { '.': { import: './import.mjs', require: './require.cjs' } },
  };
  const consumer = { name: 'consumer', main: 'index.cjs' };

  await using dependencySource = await fixture({
    'package.json': JSON.stringify(dependency),
    'import.mjs': 'export default "import";',
    'require.cjs': 'module.exports = "require";',
  });
  await using consumerSource = await fixture({
    'package.json': JSON.stringify(consumer),
    'index.cjs': 'module.exports = require("conditional");',
  });
  await using dependencyOutput = await fixture({});
  await using consumerOutput = await fixture({});
  const build = new Build();

  await build.build(
    { signal: t.signal },
    {
      packagePath: dependencySource.path,
      outputPath: dependencyOutput.path,
      packageJson: dependency,
      dependencies: [],
    },
  );

  await build.build(
    { signal: t.signal },
    {
      packagePath: consumerSource.path,
      outputPath: consumerOutput.path,
      packageJson: consumer,
      dependencies: [{ name: 'conditional', version: '1.0.0' }],
    },
  );

  const load = browserLoader({
    '/conditional@1.0.0/': dependencyOutput.path,
    '/consumer@1.0.0/': consumerOutput.path,
  });

  assert.equal(Reflect.get(await load('/conditional@1.0.0/index.js'), 'default'), 'import');
  assert.equal(Reflect.get(await load('/consumer@1.0.0/index.js'), 'default'), 'require');
});

test('selects package imports conditions separately in a module using import and require', async (t) => {
  const pkg = {
    name: 'conditional-imports',
    main: 'index.js',
    imports: { '#value': { import: './import.mjs', require: './require.cjs' } },
  };

  await using source = await fixture({
    'package.json': JSON.stringify(pkg),
    'index.js': 'import value from "#value"; export default value + require("#value");',
    'import.mjs': 'export default 40;',
    'require.cjs': 'module.exports = 2;',
  });
  await using output = await fixture({});

  await new Build().build(
    { signal: t.signal },
    { packagePath: source.path, outputPath: output.path, packageJson: pkg, dependencies: [] },
  );

  assert.equal(Reflect.get(await browserLoader({ '/': output.path })('/index.js'), 'default'), 42);
});

test('externalizes browser replacements for local files from nested modules', async (t) => {
  for (const format of ['esm', 'commonjs']) {
    for (const request of ['../server.js', '../server', '../server-dir', '#server']) {
      await t.test(`${format}: ${request}`, async () => {
        const pkg = {
          name: 'browser-files',
          main: 'src/index.js',
          imports: { '#server': './server.js' },
          browser: {
            './server.js': 'browser-dependency',
            './server-dir/index.js': 'browser-dependency',
          },
        };
        await using source = await fixture({
          'package.json': JSON.stringify(pkg),
          'src/index.js':
            format === 'esm'
              ? `export {default} from ${JSON.stringify(request)};`
              : `module.exports = require(${JSON.stringify(request)});`,
          'server.js': 'throw new Error("Server implementation must not be used");',
          'server-dir/index.js': 'throw new Error("Server implementation must not be used");',
        });
        await using output = await fixture({});

        const imports = await new Build().build(
          { signal: t.signal },
          {
            packagePath: source.path,
            outputPath: output.path,
            packageJson: pkg,
            dependencies: [{ name: 'browser-dependency', version: '1.0.0' }],
            requireSubpaths: [],
          },
        );

        assert.deepEqual(imports, [
          {
            name: 'browser-dependency',
            subpath: '',
            ...(format === 'commonjs' && { commonjs: true }),
          },
        ]);
      });
    }
  }
});
