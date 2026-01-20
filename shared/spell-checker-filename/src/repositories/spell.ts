/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Mutex } from 'async-mutex';
import nspell from 'nspell';
import type { SpellCheckerRepository } from '../entities/repositories.ts';

const PERSONAL_DICTIONARY = ['svg', 'src'].join('\n');

export class NSpellSpellChecker implements SpellCheckerRepository {
  private spell: ReturnType<typeof nspell> | null = null;
  private readonly mutexLoad = new Mutex();

  private async loadNSpell() {
    // MIT словарь для проверки на английском языке
    const urlEnDict =
      'https://raw.githubusercontent.com/wooorm/dictionaries/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/en/';

    // TODO: Кэширование на устройстве?
    const aff = await fetch(`${urlEnDict}index.aff`);
    const dic = await fetch(`${urlEnDict}index.dic`);

    this.spell = nspell(Buffer.from(await aff.arrayBuffer()), Buffer.from(await dic.arrayBuffer()));
    this.spell.personal(PERSONAL_DICTIONARY);
  }

  private async load() {
    /**
     * Блокируем мьютексом, чтобы словарь не загружался несколько раз одновременно
     */
    const release = await this.mutexLoad.acquire();

    if (!this.spell) {
      await this.loadNSpell();
    }

    release();
  }

  public async correct(word: string): Promise<boolean> {
    await this.load();

    if (!this.spell) {
      throw new Error('Spell checker is not loaded');
    }

    return this.spell.correct(word);
  }

  public async suggest(word: string): Promise<string[]> {
    await this.load();

    if (!this.spell) {
      throw new Error('Spell checker is not loaded');
    }

    return this.spell.suggest(word);
  }

  public async addToDict(words: string[]): Promise<void> {
    await this.load();

    this.spell?.personal(words.join('\n'));
  }
}

export class MockSpellChecker implements SpellCheckerRepository {
  public dict = new Set<string>();
  public suggestMap = new Map<string, string[]>();

  public async correct(word: string): Promise<boolean> {
    return this.dict.has(word);
  }

  public async suggest(word: string): Promise<string[]> {
    return this.suggestMap.get(word) ?? [];
  }

  public async addToDict(words: string[]): Promise<void> {
    words.forEach((word) => {
      this.dict.add(word);
    });
  }
}
