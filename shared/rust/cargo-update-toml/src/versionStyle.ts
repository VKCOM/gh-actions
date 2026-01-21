/**
 * Возвращает количество вхождений `word` в строке `string`
 */
function countInstances(string: string, word: string) {
  return string.split(word).length - 1;
}

/**
 * Приводит версию к изначальному стилю
 *
 * ```js
 * versionStyle("0", "1.2.3") // "1"
 * versionStyle("0.1", "1.2.3") // "1.2"
 * versionStyle("0.1.2", "1.2.3") // "1.2.3"
 *
 * versionStyle("^0.1.2", "1.2.3") // "^1.2.3"
 *
 * versionStyle("~0", "1.2.3") // "~1"
 * versionStyle("~0.1", "1.2.3") // "~1.2"
 * versionStyle("~0.1.2", "1.2.3") // "~1.2.3"
 *
 * versionStyle("*", "1.2.3") // "*"
 * versionStyle("0.*", "1.2.3") // "1.*"
 * versionStyle("0.1.*", "1.2.3") // "1.2.*"
 * ```
 *
 * https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#version-requirement-syntax
 */
export function versionStyle(version: string, newVersion: string) {
  if (version.indexOf(',') > 0) {
    // Multiple version requirements
    return version;
  }

  const re = /[\d.]+(?!\*)/;

  const match = version.match(re);
  if (match === null) {
    // У версии может не быть числа(например "*")
    return version;
  }

  const subVersion = newVersion
    .split('.')
    .slice(0, countInstances(match[0], '.') + 1)
    .join('.');

  return version.replace(re, subVersion);
}
