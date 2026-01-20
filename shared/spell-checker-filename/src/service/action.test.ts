import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Repositories } from '../entities/repositories.ts';
import { MockSpellChecker } from '../repositories/spell.ts';
import { ActionService } from './action.ts';

test('Action checkPath', async () => {
  const spellCheckerRepository = new MockSpellChecker();
  spellCheckerRepository.dict = new Set(['path', 'to', 'file', 'svg']);

  const repositories = {
    spellCheckerRepository,
    githubRepository: {},
  } as unknown as Repositories;

  const action = new ActionService(repositories);

  assert.deepStrictEqual(await action.checkPath('path/to_file'), []);
  assert.deepStrictEqual(await action.checkPath('path/to_file/40.svg'), []);
  assert.deepStrictEqual(await action.checkPath('path/to_file/bad'), ['bad']);
});
