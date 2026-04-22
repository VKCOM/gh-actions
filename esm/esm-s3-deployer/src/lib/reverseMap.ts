export function reverseMap<K, V>(originalMap: Map<K, V>): Map<V, K> {
  const reversedMap = new Map<V, K>();

  for (const [key, value] of originalMap.entries()) {
    reversedMap.set(value, key);
  }

  return reversedMap;
}
