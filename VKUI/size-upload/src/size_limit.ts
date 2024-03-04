import * as fs from 'node:fs/promises';

interface Size {
  name: string;
  size: number;
}

export async function getSizesFromJSON(path: string): Promise<Size[]> {
  const buf = await fs.readFile(path);

  return JSON.parse(buf.toString());
}
