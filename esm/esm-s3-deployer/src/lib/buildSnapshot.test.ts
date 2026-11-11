import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'es-module-lexer';
import { buildSnapshot } from './buildSnapshot.ts';

test('pins static, dynamic and relative imports while preserving ordinary strings', async () => {
  const files = new Map([
    [
      'app@1.0.0/index.js',
      Buffer.from(
        'import {value} from "/dependency@1.0.0/index.js";' +
          'export {default} from "/dependency@1.0.0/index.js";' +
          "export const lazy = () => import('/dependency@1.0.0/index.js');" +
          'export const text = "/dependency@1.0.0/index.js";' +
          'import "./chunks/shared.js";',
      ),
    ],
    ['dependency@1.0.0/index.js', Buffer.from('export const value = 42; export default value;')],
    ['app@1.0.0/chunks/shared.js', Buffer.from('export const shared = true;')],
    ['app@1.0.0/image.png', Buffer.from([0, 255, 1])],
  ]);
  const snapshot = await buildSnapshot(files);
  const app = snapshot.files.get('app@1.0.0/index.js');

  assert.ok(app);
  const code = app.immutable.toString();

  assert.deepEqual(
    parse(code)[0].map(({ n }) => n),
    [
      `/${snapshot.files.get('dependency@1.0.0/index.js')?.immutableKey}`,
      `/${snapshot.files.get('dependency@1.0.0/index.js')?.immutableKey}`,
      `/${snapshot.files.get('dependency@1.0.0/index.js')?.immutableKey}`,
      `/${snapshot.files.get('app@1.0.0/chunks/shared.js')?.immutableKey}`,
    ],
  );

  assert.ok(code.includes('export const text = "/dependency@1.0.0/index.js"'));
  assert.deepEqual(
    parse(app.entry.toString())[1].map(({ n }) => n),
    ['default'],
  );

  assert.deepEqual(
    snapshot.files.get('app@1.0.0/image.png')?.immutable,
    files.get('app@1.0.0/image.png'),
  );
});

test('changes only the updated file and its transitive consumers, independent of file order', async () => {
  const root = [
    'app@1.0.0/index.js',
    Buffer.from('export {value} from "/bridge@1.0.0/index.js";'),
  ] as const;
  const bridge = [
    'bridge@1.0.0/index.js',
    Buffer.from('export {value} from "/dependency@1.0.0/index.js";'),
  ] as const;
  const dependency = ['dependency@1.0.0/index.js', Buffer.from('export const value = 1;')] as const;
  const independent = ['app@1.0.0/independent.js', Buffer.from('export const other = 7;')] as const;
  const original = await buildSnapshot(new Map([root, bridge, dependency, independent]));
  const reordered = await buildSnapshot(new Map([independent, dependency, bridge, root]));

  assert.deepEqual(original.files, reordered.files);
  assert.equal(
    new Set([...original.files.values()].map(({ immutableKey }) => immutableKey.split('/')[1]))
      .size,
    4,
  );

  const updated = await buildSnapshot(
    new Map([root, bridge, [dependency[0], Buffer.from('export const value = 2;')], independent]),
  );

  for (const [key] of [root, bridge, dependency]) {
    assert.notEqual(
      updated.files.get(key)?.immutableKey,
      original.files.get(key)?.immutableKey,
      key,
    );
    assert.notDeepEqual(updated.files.get(key)?.entry, original.files.get(key)?.entry, key);
  }
  assert.deepEqual(updated.files.get(independent[0]), original.files.get(independent[0]));

  const added = await buildSnapshot(
    new Map([
      ...new Map([root, bridge, dependency, independent]),
      ['new@1.0.0/index.js', Buffer.from('export default 3;')],
    ]),
  );
  for (const [key, file] of original.files) assert.deepEqual(added.files.get(key), file, key);
});

test('rejects imports missing from the immutable graph', async () => {
  for (const specifier of ['/missing@1.0.0/index.js', './chunks/missing.js']) {
    await assert.rejects(
      buildSnapshot(
        new Map([
          ['app@1.0.0/index.js', Buffer.from(`export {value} from ${JSON.stringify(specifier)};`)],
        ]),
      ),
      /Missing snapshot module/,
    );
  }
});

test('hashes cycles and self imports without invalidating independent modules', async () => {
  const root = ['app@1.0.0/index.js', Buffer.from('export {value} from "./a.js";')] as const;
  const a = [
    'app@1.0.0/a.js',
    Buffer.from('export {value} from "./b.js"; export const self = () => import("./a.js");'),
  ] as const;
  const independent = ['app@1.0.0/other.js', Buffer.from('export const other = 7;')] as const;

  async function build(value: number) {
    return buildSnapshot(
      new Map([
        root,
        a,
        [
          'app@1.0.0/b.js',
          Buffer.from(`export {self} from "./a.js"; export const value = ${value};`),
        ],
        independent,
      ]),
    );
  }

  const original = await build(1);
  const updated = await build(2);
  for (const key of [root[0], a[0], 'app@1.0.0/b.js']) {
    assert.notEqual(original.files.get(key)?.immutableKey, updated.files.get(key)?.immutableKey);
  }
  assert.deepEqual(original.files.get(independent[0]), updated.files.get(independent[0]));

  const fileA = updated.files.get(a[0]);
  const fileB = updated.files.get('app@1.0.0/b.js');
  assert.ok(fileA && fileB);
  assert.equal(fileA.immutableKey.split('/')[1], fileB.immutableKey.split('/')[1]);
  assert.deepEqual(
    parse(fileA.immutable.toString())[0].map(({ n }) => n),
    [`/${fileB.immutableKey}`, `/${fileA.immutableKey}`],
  );
});

test('preserves query strings, fragments and parent-directory chunk imports', async () => {
  const files = new Map([
    [
      'app@1.0.0/chunks/entry.mjs',
      Buffer.from(
        'export {value} from "../shared.mjs?mode=1#value"; export const load = () => import("../shared.mjs#lazy");',
      ),
    ],
    ['app@1.0.0/shared.mjs', Buffer.from('export const value = 42;')],
  ]);
  const snapshot = await buildSnapshot(files);
  const entry = snapshot.files.get('app@1.0.0/chunks/entry.mjs');
  const shared = snapshot.files.get('app@1.0.0/shared.mjs');
  assert.ok(entry && shared);
  assert.deepEqual(
    parse(entry.immutable.toString())[0].map(({ n }) => n),
    [`/${shared.immutableKey}?mode=1#value`, `/${shared.immutableKey}#lazy`],
  );
});

test('keeps import.meta output and its assets together without invalidating other packages', async () => {
  const runtime = [
    '@scope/app@1.0.0/chunks/runtime.js',
    Buffer.from('export const base = new URL("../", import.meta.url);'),
  ] as const;
  const entry = [
    '@scope/app@1.0.0/index.js',
    Buffer.from('export {base} from "./chunks/runtime.js";'),
  ] as const;
  const other = ['other@1.0.0/index.js', Buffer.from('export default 7;')] as const;
  const assetKey = '@scope/app@1.0.0/image.png';
  const original = await buildSnapshot(
    new Map([runtime, entry, other, [assetKey, Buffer.from([0, 255])]]),
  );
  const updated = await buildSnapshot(
    new Map([runtime, entry, other, [assetKey, Buffer.from([1, 255])]]),
  );

  for (const [key] of [runtime, entry]) {
    assert.notEqual(original.files.get(key)?.immutableKey, updated.files.get(key)?.immutableKey);
  }
  assert.deepEqual(original.files.get(other[0]), updated.files.get(other[0]));
  const runtimeFile = updated.files.get(runtime[0]);
  const asset = updated.files.get(assetKey);
  assert.ok(runtimeFile && asset);
  assert.equal(
    new URL('../image.png', `https://cdn.test/${runtimeFile.immutableKey}`).pathname,
    `/${asset.immutableKey}`,
  );
});

test('keeps computed relative imports in a shared immutable directory', async () => {
  const snapshot = await buildSnapshot(
    new Map([
      [
        'app@1.0.0/index.js',
        Buffer.from('export const load = name => import("./chunks/" + name + ".js");'),
      ],
      ['app@1.0.0/chunks/feature.js', Buffer.from('export const value = 42;')],
      ['other@1.0.0/index.js', Buffer.from('export default 7;')],
    ]),
  );
  const entry = snapshot.files.get('app@1.0.0/index.js');
  const feature = snapshot.files.get('app@1.0.0/chunks/feature.js');
  assert.ok(entry && feature);
  assert.equal(
    new URL('./chunks/feature.js', `https://cdn.test/${entry.immutableKey}`).pathname,
    `/${feature.immutableKey}`,
  );
  assert.notEqual(
    entry.immutableKey.split('/')[1],
    snapshot.files.get('other@1.0.0/index.js')?.immutableKey.split('/')[1],
  );
});
