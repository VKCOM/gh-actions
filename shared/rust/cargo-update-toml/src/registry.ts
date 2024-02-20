import * as readline from 'node:readline/promises';
import * as https from 'node:https';
import { getLastLine } from './getLastLine';

const HTTPStatusOK = 200;

/**
 * HTTPS get запрос обернутый в промис
 */
async function get(url: string | https.RequestOptions | URL) {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== HTTPStatusOK) {
          response.resume();
          reject(new Error(`Get "${url}" failed. HTTP status is ${response.statusCode}`));

          return;
        }

        resolve(response);
      })
      .on('error', reject);
  });
}

/**
 * Возвращает url для crate пакета
 */
function indexPackageURL(name: string) {
  const url = ['https://raw.githubusercontent.com/rust-lang/crates.io-index/master'];

  if (name.length <= 3) {
    url.push(name.length.toString(), name[0]);
  } else {
    url.push(name.substring(0, 2), name.substring(2, 4));
  }

  url.push(name);

  return url.join('/');
}

type Features = Record<string, string[]>;

// A single line in the index representing a single version of a package.
//
// https://github.com/rust-lang/cargo/blob/e7ff7a6618ad6f35372da1777f96dfb5716fded9/src/cargo/sources/registry/index.rs#L336
export interface IndexPackage {
  // Name of the package.
  name: string;
  // The version of this dependency.
  vers: string;
  // All kinds of direct dependencies of the package, including dev and
  // build dependencies.
  deps: RegistryDependency[];
  // Set of features defined for the package, i.e., `[features]` table.
  features: Features;
  // This field contains features with new, extended syntax. Specifically,
  // namespaced features (`dep:`) and weak dependencies (`pkg?/feat`).
  //
  // This is separated from `features` because versions older than 1.19
  // will fail to load due to not being able to parse the new syntax, even
  // with a `Cargo.lock` file.
  features2?: Features;
  // Checksum for verifying the integrity of the corresponding downloaded package.
  cksum: string;
  // If `true`, Cargo will skip this version when resolving.
  //
  // This was added in 2014. Everything in the crates.io index has this set
  // now, so this probably doesn't need to be an option anymore.
  yanked?: boolean;
  // Native library name this package links to.
  //
  // Added early 2018 (see <https://github.com/rust-lang/cargo/pull/4978>),
  // can be `None` if published before then.
  links?: string;
  // Required version of rust
  //
  // Corresponds to `package.rust-version`.
  //
  // Added in 2023 (see <https://github.com/rust-lang/crates.io/pull/6267>),
  // can be `None` if published before then or if not set in the manifest.
  rust_version?: string;
  // The schema version for this entry.
  //
  // If this is None, it defaults to version `1`. Entries with unknown
  // versions are ignored.
  //
  // Version `2` schema adds the `features2` field.
  //
  // Version `3` schema adds `artifact`, `bindep_targes`, and `lib` for
  // artifact dependencies support.
  //
  // This provides a method to safely introduce changes to index entries
  // and allow older versions of cargo to ignore newer entries it doesn't
  // understand. This is honored as of 1.51, so unfortunately older
  // versions will ignore it, and potentially misinterpret version 2 and
  // newer entries.
  //
  // The intent is that versions older than 1.51 will work with a
  // pre-existing `Cargo.lock`, but they may not correctly process `cargo
  // update` or build a lock from scratch. In that case, cargo may
  // incorrectly select a new package that uses a new index schema. A
  // workaround is to downgrade any packages that are incompatible with the
  // `--precise` flag of `cargo update`.
  v?: number;
}

// A dependency as encoded in the [`IndexPackage`] index JSON.
export interface RegistryDependency {
  // Name of the dependency. If the dependency is renamed, the original
  // would be stored in [`RegistryDependency::package`].
  name: string;
  // The SemVer requirement for this dependency.
  req: string;
  // Set of features enabled for this dependency.
  features: string[];
  // Whether or not this is an optional dependency.
  optional: boolean;
  // Whether or not default features are enabled.
  default_features: boolean;
  // The target platform for this dependency.
  target?: string;
  // The dependency kind. "dev", "build", and "normal"
  kind?: 'dev' | 'build' | 'normal';
  // The URL of the index of the registry where this dependency is from.
  // `None` if it is from the same index.
  registry?: string;
  // The original name if the dependency is renamed.
  package?: string;
  // Whether or not this is a public dependency. Unstable. See [RFC 1977].
  //
  // [RFC 1977]: https://rust-lang.github.io/rfcs/1977-public-private-dependencies.html
  public?: boolean;
  artifact?: string[];
  bindep_target?: string;
  lib?: boolean;
}

/**
 * Парсит индекс из стрима построчно
 */
export function parsePackagesFromStream(input: NodeJS.ReadableStream) {
  return new Promise<IndexPackage[]>((resolve, reject) => {
    const rl = readline.createInterface(input);

    const packages: IndexPackage[] = [];
    rl.on('line', function (line) {
      packages.push(JSON.parse(line));
    });

    rl.on('error', reject);

    rl.on('close', function () {
      resolve(packages);
    });
  });
}

/**
 * Возвращает все версии пакета из индекса.
 */
export async function cargoRegistryIndexPackages(name: string): Promise<IndexPackage[]> {
  const url = indexPackageURL(name);

  const stream = await get(url);

  return await parsePackagesFromStream(stream);
}

/**
 * Возвращает последнюю информацию о пакете
 */
export async function cargoRegistryLastIndexPackage(name: string): Promise<IndexPackage> {
  const url = indexPackageURL(name);

  const stream = await get(url);

  const lastLine = await getLastLine(stream);

  return JSON.parse(lastLine);
}
