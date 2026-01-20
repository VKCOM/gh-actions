/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ActionService } from './action.ts';
import { MockSpellChecker } from '../repositories/spell.ts';

test('Action checkPath', async () => {
  const repositories = {
    spellCheckerRepository: new MockSpellChecker(),
    githubRepository: {} as any,
  };

  repositories.spellCheckerRepository.dict = new Set(['path', 'to', 'file', 'svg']);

  const action = new ActionService(repositories);

  assert.deepStrictEqual(await action.checkPath('path/to_file'), []);
  assert.deepStrictEqual(await action.checkPath('path/to_file/40.svg'), []);
  assert.deepStrictEqual(await action.checkPath('path/to_file/bad'), ['bad']);
});
