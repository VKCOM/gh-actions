import { expect, test } from '@jest/globals';

import { cargoRegistryLastIndexPackage } from './registry';

test('cargoRegistryLastIndexPackage get md4', async () => {
  const lastPackage = await cargoRegistryLastIndexPackage('md4');

  expect(lastPackage.name).toBe('md4');
});
