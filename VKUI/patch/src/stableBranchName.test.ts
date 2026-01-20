/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { stableBranchName } from './stableBranchName.ts';
import { SemVer } from 'semver';

test('stableBranchName version 1.1.0 is 1.1-stable', () => {
  assert.strictEqual(stableBranchName(new SemVer('1.1.0')), '1.1-stable');
});

test('stableBranchName version 1.2.3 is 1.2-stable', () => {
  assert.strictEqual(stableBranchName(new SemVer('1.2.3')), '1.2-stable');
});

test('stableBranchName version 0.2.3 is 0.2-stable', () => {
  assert.strictEqual(stableBranchName(new SemVer('0.2.3')), '0.2-stable');
});
