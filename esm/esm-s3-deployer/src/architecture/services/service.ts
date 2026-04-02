import type { Repositories } from '../entities/repositories.ts';

export class Service {
  protected readonly repositories: Repositories;

  constructor(repositories: Repositories) {
    this.repositories = repositories;
  }
}
