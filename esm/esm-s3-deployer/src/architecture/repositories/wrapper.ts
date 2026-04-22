export class WrapperRepository<T> {
  protected readonly repository: T;

  constructor(repository: T) {
    this.repository = repository;
  }
}
