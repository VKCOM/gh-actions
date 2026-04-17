export function chunk<T>(array: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }

  const resultArrayLength = Math.ceil(array.length / size);

  const chunkedArr: T[][] = new Array<T[]>(resultArrayLength);

  for (let i = 0; i < array.length; i += size) {
    chunkedArr[Math.floor(i / size)] = array.slice(i, i + size);
  }

  return chunkedArr;
}
