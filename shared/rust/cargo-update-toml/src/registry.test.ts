/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты*/

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cargoRegistryLastIndexPackage } from './registry.ts';

describe('cargoRegistryLastIndexPackage', () => {
  it('get md4', async () => {
    const lastPackage = await cargoRegistryLastIndexPackage('md4');

    assert.strictEqual(lastPackage.name, 'md4');
  });
});
