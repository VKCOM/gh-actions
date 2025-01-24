import { expect, test } from '@jest/globals';
import { ActionService } from './action';
import { MockSpellChecker } from '../repositories/spell';

test('Action checkPath', async () => {
  const repositories = {
    spellCheckerRepository: new MockSpellChecker(),
    githubRepository: {} as any,
  };

  repositories.spellCheckerRepository.dict = new Set(['path', 'to', 'file', 'svg']);

  const action = new ActionService(repositories);

  expect(await action.checkPath('path/to_file')).toEqual([]);
  expect(await action.checkPath('path/to_file/40.svg')).toEqual([]);
  expect(await action.checkPath('path/to_file/bad')).toEqual(['bad']);
});
