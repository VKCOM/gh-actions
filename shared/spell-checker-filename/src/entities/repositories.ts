export interface SpellCheckerRepository {
  /**
   * Проверяет слово на ошибки
   */
  correct(word: string): Promise<boolean>;

  /**
   * Предлагает варианты исправления слова
   */
  suggest(word: string): Promise<string[]>;

  /**
   * Добавляет слова в словарь
   */
  addToDict(words: string[]): Promise<void>;
}

export interface GithubRepository {
  /**
   * Возвращает список измененных файлов из pull request'а
   */
  pullRequestPaths(): Promise<string[]>;

  /**
   * Создает предупреждение для файла в pull request'е
   */
  warningFile(path: string, message: string): Promise<void>;
}

export interface Repositories {
  spellCheckerRepository: SpellCheckerRepository;
  githubRepository: GithubRepository;
}
