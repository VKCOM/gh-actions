import { Configuration } from '../entities/config.ts';
import type { Context } from '../entities/context.ts';
import type { ConfigurationRepository } from '../entities/repositories.ts';
import { WrapperRepository } from './wrapper.ts';

export class ConfigurationFromObject implements ConfigurationRepository {
  readonly #cfg: Configuration;

  constructor(cfg: Configuration) {
    this.#cfg = cfg;
  }

  async get(_ctx: Context): Promise<Configuration> {
    return this.#cfg;
  }
}

export class ConfigurationTesting implements ConfigurationRepository {
  async get(_ctx: Context): Promise<Configuration> {
    return Configuration.parse({
      packages: {},
      s3: {
        bucket: 'test-bucket',
      },
    });
  }
}

export class ConfigurationCache
  extends WrapperRepository<ConfigurationRepository>
  implements ConfigurationRepository
{
  #cache: Configuration | undefined;

  async get(ctx: Context): Promise<Configuration> {
    if (this.#cache) return this.#cache;

    const result = await this.repository.get(ctx);

    this.#cache = result;

    return result;
  }
}
