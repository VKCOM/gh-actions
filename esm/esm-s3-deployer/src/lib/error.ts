export function promiseRecordMap<V, T>(
  record: Record<string, V>,
  callbackfn: (v: [key: string, value: V]) => Promise<T>,
): Promise<T[]> {
  const promises = Object.entries(record).map(callbackfn);

  return Promise.all(promises);
}
