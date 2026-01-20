import * as fs from "node:fs/promises";
import * as core from "@actions/core";
import { cargoRegistryLastIndexPackage } from "./registry.ts";
import { versionStyle } from "./versionStyle.ts";

/**
 * Возвращает последнюю версию crate пакета
 */
async function crateRegistryVersion(name: string) {
  const index = await cargoRegistryLastIndexPackage(name);
  return index.vers;
}

/**
 * Обновляет зависимость
 */
async function updateDependency(data: string, name: string) {
  const lastVersion = await crateRegistryVersion(name);
  const searchValue = new RegExp(
    `(${name}[\\s]+=[\\s\\n]+(\\{.*?version\\s+=\\s+|))"([\\d.]+)"`,
    "m",
  );

  const match = data.match(searchValue);
  if (match === null) {
    throw new Error("Dependency not found in Cargo.toml");
  }

  const replaceValue = `$1"${versionStyle(match[3], lastVersion)}"`;

  return data.replace(searchValue, replaceValue);
}

async function run() {
  try {
    const packages = core.getInput("packages", { required: true }).split(/[\n,]/);
    const filepath = "Cargo.toml";
    const encoding = "utf8";

    const data = await fs.readFile(filepath, encoding);

    let result = data;
    for (const name of packages) {
      result = await updateDependency(result, name);
    }

    await fs.writeFile(filepath, result, encoding);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
