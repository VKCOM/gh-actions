import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { test } from 'node:test';
import { createContext, SourceTextModule } from 'node:vm';
import { Configuration } from '../src/architecture/entities/config.ts';
import type { Repositories } from '../src/architecture/entities/repositories.ts';
import { ConfigurationFromObject } from '../src/architecture/repositories/configuration.ts';
import { halfProductionRepository } from '../src/architecture/repositories/repositories.ts';
import { MainService } from '../src/architecture/services/main.ts';

test('builds @vkontakte/icons and loads its complete browser module graph', {
  timeout: 180_000,
}, async (t) => {
  const ctx = { signal: t.signal };
  await using cdn = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'esm-icons-test-'));
  const repositories: Repositories = {
    ...(await halfProductionRepository(ctx)),
    configuration: new ConfigurationFromObject(
      Configuration.parse({
        packages: { '@vkontakte/icons': '3.80.0' },
        timeout: { registry: 60_000 },
        s3: { bucket: 'unused' },
      }),
    ),
    s3: {
      async upload(_ctx, stream, key, contentType, options) {
        if (key.endsWith('.js')) assert.match(contentType, /javascript/);
        if (key.startsWith('__builds/')) assert.match(options?.CacheControl ?? '', /immutable/);
        if (key === '@vkontakte/icons@3.80.0/index.js') {
          assert.match(options?.CacheControl ?? '', /no-cache/);
          assert.doesNotMatch(options?.CacheControl ?? '', /immutable/);
        }

        const file = path.join(cdn.path, key);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await pipeline(stream, createWriteStream(file));
      },
      async list() {
        return [];
      },
      async copy() {},
      async delete() {},
    },
  };

  await new MainService(repositories).run(ctx);

  // Load as browser ESM: no Node globals, bare-import resolution or CommonJS loader.
  const context = createContext({ console });
  const modules = new Map<string, Promise<SourceTextModule>>();

  function load(url: string): Promise<SourceTextModule> {
    let result = modules.get(url);
    if (!result) {
      result = fs.readFile(path.join(cdn.path, url), 'utf8').then(
        (code) =>
          new SourceTextModule(code, {
            context,
            identifier: url,
          }),
      );
      modules.set(url, result);
    }

    return result;
  }

  const icons = await load('/@vkontakte/icons@3.80.0/index.js');
  await icons.link((specifier, referencingModule) => {
    assert.ok(specifier.startsWith('/') || specifier.startsWith('.'), `Bare import: ${specifier}`);

    return load(new URL(specifier, `https://cdn.test${referencingModule.identifier}`).pathname);
  });
  await icons.evaluate();

  assert.ok(Object.keys(icons.namespace).length > 3000);
  assert.equal(typeof Reflect.get(icons.namespace, 'Icon24Add'), 'function');
  assert.ok(modules.size > 1, 'Dependencies must be loaded from the generated CDN');
  const hashes = new Set<string>();

  for (const url of modules.keys()) {
    if (url === icons.identifier) continue;

    const hash = /^\/__builds\/([a-f0-9]{64})\//.exec(url)?.[1];

    assert.ok(hash, `Module escaped the immutable graph: ${url}`);
    hashes.add(hash);
  }

  assert.ok(hashes.size > 1, 'Independent modules must have separate hashes');
});
