import { expect, test } from '@jest/globals';
import { stableBranchName } from './stableBranchName';
import { SemVer } from 'semver';

test.each([
  { version: '1.1.0', expected: '1.1-stable' },
  { version: '1.2.3', expected: '1.2-stable' },
  { version: '0.2.3', expected: '0.2-stable' },
])('stableBranchName($version) is $expected', ({ version, expected }) => {
  expect(stableBranchName(new SemVer(version))).toBe(expected);
});
