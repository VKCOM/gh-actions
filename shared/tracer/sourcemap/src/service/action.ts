import { Service } from './service';

export class ActionService extends Service {
  public async run(): Promise<void> {
    const { path, ...options } = await this.repositories.githubRepository.getInput();

    await this.repositories.tracerSourceMapRepository.uploadSourcemap(path, options);
  }
}
