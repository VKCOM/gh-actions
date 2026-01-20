function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * Сортирует объект рекурсивно.
 *
 * # Пример
 *
 * ```
 * accert.equal(
 *   JSON.stringify(sort({ b: 2, c: { b: 1, a: 2 }, a: 1 })),
 *   `{"a":1,"b":2,"c":{"a":2,"b":1}}`,
 * );
 * ```
 */
export function sortObjectRecursively<T>(value: T): T {
  if (!isObject(value)) {
    return value;
  }

  // С ES6 ключи в объектах находятся в том порядке, в котором они были созданы
  //
  // https://exploringjs.com/es6/ch_oop-besides-classes.html#_traversal-order-of-properties

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((obj, key) => {
      obj[key] = sortObjectRecursively(value[key]);
      return obj;
    }, {}) as T;
}
