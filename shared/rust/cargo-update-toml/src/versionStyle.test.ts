import { expect, test } from '@jest/globals';
import { versionStyle } from './versionStyle';

test.each([
  { version: '0', newVersion: '1.2.3', expected: '1' },
  { version: '0.1', newVersion: '1.2.3', expected: '1.2' },
  { version: '0.1.2', newVersion: '1.2.3', expected: '1.2.3' },
  { version: '^0.1.2', newVersion: '1.2.3', expected: '^1.2.3' },
  { version: '~0', newVersion: '1.2.3', expected: '~1' },
  { version: '~0.1', newVersion: '1.2.3', expected: '~1.2' },
  { version: '~0.1.2', newVersion: '1.2.3', expected: '~1.2.3' },
  { version: '*', newVersion: '1.2.3', expected: '*' },
  { version: '0.*', newVersion: '1.2.3', expected: '1.*' },
  { version: '0.1.*', newVersion: '1.2.3', expected: '1.2.*' },
])(
  'versionStyle("$version", "$newVersion") is "$expected"',
  ({ version, newVersion, expected }) => {
    expect(versionStyle(version, newVersion)).toBe(expected);
  },
);
