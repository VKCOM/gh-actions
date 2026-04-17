import * as assert from 'node:assert/strict';
import * as test from 'node:test';
import { chunk } from './chunk.ts';

test.test('chunk should split array into chunks of specified size', () => {
  const array = [1, 2, 3, 4, 5, 6, 7, 8];
  const result = chunk(array, 3);
  assert.deepStrictEqual(result, [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8],
  ]);
});

test.test('chunk should return empty array when input is empty', () => {
  const result = chunk([], 3);
  assert.deepStrictEqual(result, []);
});

test.test('chunk should handle chunk size larger than array length', () => {
  const array = [1, 2, 3];
  const result = chunk(array, 5);
  assert.deepStrictEqual(result, [[1, 2, 3]]);
});

test.test('chunk should handle chunk size equal to array length', () => {
  const array = [1, 2, 3, 4];
  const result = chunk(array, 4);
  assert.deepStrictEqual(result, [[1, 2, 3, 4]]);
});

test.test('chunk should handle chunk size of 1', () => {
  const array = [1, 2, 3];
  const result = chunk(array, 1);
  assert.deepStrictEqual(result, [[1], [2], [3]]);
});

test.test('chunk should handle chunk size of 0 (should throw error)', () => {
  const array = [1, 2, 3];
  assert.throws(() => {
    chunk(array, 0);
  }, Error);
});

test.test('chunk should work with strings', () => {
  const array = ['a', 'b', 'c', 'd', 'e'];
  const result = chunk(array, 2);
  assert.deepStrictEqual(result, [['a', 'b'], ['c', 'd'], ['e']]);
});

test.test('chunk should work with objects', () => {
  const array = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const result = chunk(array, 2);
  assert.deepStrictEqual(result, [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }, { id: 4 }],
  ]);
});
