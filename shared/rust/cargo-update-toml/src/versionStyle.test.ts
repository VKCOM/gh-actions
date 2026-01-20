/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { versionStyle } from './versionStyle.ts';

describe('versionStyle', () => {
  const cases = [
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
  ];

  cases.forEach(({ version, newVersion, expected }) => {
    it(`versionStyle("${version}", "${newVersion}") is "${expected}"`, () => {
      assert.strictEqual(versionStyle(version, newVersion), expected);
    });
  });
});
