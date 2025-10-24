import fs from 'fs';
import semver from 'semver';

// Получает текущую версию пакета VKUI
export function getCurrentVersion(): string {
  const packageJson = JSON.parse(fs.readFileSync('packages/vkui/package.json', 'utf8'));
  return packageJson.version;
}

// Вычисляет следующую минорную версию
export function getNextMinorVersion(currentVersion: string): string {
  const nextVersion = semver.inc(currentVersion, 'minor');
  if (!nextVersion) {
    throw new Error('Failed to increment version');
  }
  return nextVersion;
}
