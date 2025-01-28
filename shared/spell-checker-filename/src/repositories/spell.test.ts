import { expect, test } from '@jest/globals';

import { NSpellSpellChecker } from './spell';

const spellChecker = new NSpellSpellChecker();

test('NSpellSpellChecker check', async () => {
  expect(await spellChecker.correct('hello')).toBeTruthy();
  expect(await spellChecker.correct('helloo')).toBeFalsy();
});

test('NSpellSpellChecker check personal dictionary', async () => {
  expect(await spellChecker.correct('svg')).toBeTruthy();
  expect(await spellChecker.correct('src')).toBeTruthy();
});

test('NSpellSpellChecker suggest', async () => {
  expect(await spellChecker.suggest('helloo')).toEqual(['hello', 'halloo', 'hellos']);
});

test('NSpellSpellChecker check', async () => {
  expect(await spellChecker.correct('npm')).toBeFalsy();
  await spellChecker.addToDict(['npm']);
  expect(await spellChecker.correct('npm')).toBeTruthy();
});
