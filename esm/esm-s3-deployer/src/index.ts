import type { Configuration } from './architecture/entities/config.ts';
import type { Repositories } from './architecture/entities/repositories.ts';
import { libRepository } from './architecture/repositories/repositories.ts';
import { MainService } from './architecture/services/main.ts';

export async function run(cfg: Configuration) {
  const ctx = {
    signal: AbortSignal.any([]),
  };
  const repositories: Repositories = await libRepository(ctx, cfg);

  const service = new MainService(repositories);

  await service.run(ctx);
}
