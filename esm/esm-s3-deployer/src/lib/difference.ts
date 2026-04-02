/**
 * Returns elements from array1 that are not in array2.
 *
 * @example
 * difference([1, 2, 3], [1, 2, 3]) // []
 * difference([1, 2, 3], [1]) // [2, 3]
 * difference([1, 2, 3], [1, 10, 100]) // [2, 3]
 */
export function difference<T>(array1: readonly T[] = [], array2: readonly T[] = []): T[] {
  const set2 = new Set(array2);
  return array1.filter((item) => !set2.has(item));
}
