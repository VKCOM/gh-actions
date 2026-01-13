import type { Repositories } from '../entities/repositories';

/**
 * Базовый класс сервиса, для доступа к [адаптерам](../repositories/)
 */
export class Service {
  protected readonly repositories: Repositories;

  public constructor(repositories: Repositories) {
    this.repositories = repositories;
  }
}
