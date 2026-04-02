import * as test from 'node:test';
import { halfProductionRepository } from '../repositories/repositories.ts';
import { RegistryService } from './registry.ts';

test.test('cyclic dependencies', async (t) => {
  const ctx = { signal: t.signal };

  const packageResolveService = new RegistryService(await halfProductionRepository(ctx));

  await packageResolveService.resolve(ctx, 'example-circular-dependencies-2-polo', '1.0.0');
});
