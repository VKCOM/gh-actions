/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты*/
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cargoRegistryLastIndexPackage } from './registry.ts';

describe('cargoRegistryLastIndexPackage', () => {
  it('get md4', async () => {
    const lastPackage = await cargoRegistryLastIndexPackage('md4');

    assert.strictEqual(lastPackage.name, 'md4');
  });
});
