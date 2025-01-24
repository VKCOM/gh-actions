import { Service } from './service';

export class ActionService extends Service {
  /**
   * Проверяет путь на наличие ошибок в словах
   */
  public async checkPath(path: string): Promise<string[]> {
    const result: string[] = [];
    const words = path
      .replace(/[-_\/\d\.]/g, ' ')
      .split(' ')
      .filter((word) => word);

    for (const word of words) {
      if (await this.repositories.spellCheckerRepository.correct(word)) {
        continue;
      }

      result.push(word);
    }

    return result;
  }

  /**
   * Запускает проверку всех путей из пулл реквеста
   */
  public async run(): Promise<void> {
    const paths = await this.repositories.githubRepository.pullRequestPaths();

    for await (const filePath of paths) {
      const word = await this.checkPath(filePath);
      if (!word.length) continue;

      await this.repositories.githubRepository.warningFile(
        filePath,
        `Возможно ошибочное написание слова '${word.join(' ')}' в пути к файлу ${filePath}`,
      );
    }
  }
}
