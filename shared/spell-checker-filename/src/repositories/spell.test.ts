/* eslint-disable @typescript-eslint/no-floating-promises */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { NSpellSpellChecker } from './spell.ts';

const spellChecker = new NSpellSpellChecker();

test('NSpellSpellChecker check', async () => {
  assert.ok(await spellChecker.correct('hello'));
  assert.ok(!(await spellChecker.correct('helloo')));
});

test('NSpellSpellChecker check personal dictionary', async () => {
  assert.ok(await spellChecker.correct('svg'));
  assert.ok(await spellChecker.correct('src'));
});

test('NSpellSpellChecker suggest', async () => {
  assert.deepStrictEqual(await spellChecker.suggest('helloo'), ['hello', 'halloo', 'hellos']);
});

test('NSpellSpellChecker check', async () => {
  assert.ok(!(await spellChecker.correct('npm')));
  await spellChecker.addToDict(['npm']);
  assert.ok(await spellChecker.correct('npm'));
});
