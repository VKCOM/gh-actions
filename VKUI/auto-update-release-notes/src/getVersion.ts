import fs from 'fs';
import semver from 'semver';

// Получает текущую версию пакета VKUI
function getCurrentVersion(): string {
  const packageJson = JSON.parse(fs.readFileSync('packages/vkui/package.json', 'utf8'));
  return packageJson.version;
}

// Вычисляет следующую минорную версию
function getNextMinorVersion(currentVersion: string): string {
  const nextVersion = semver.inc(currentVersion, 'minor');
  if (!nextVersion) throw new Error('Failed to increment version');
  return nextVersion;
}

// Вычисляет следующую patch версию
function getNextPatchVersion(currentVersion: string): string {
  const nextVersion = semver.inc(currentVersion, 'patch');
  if (!nextVersion) throw new Error('Failed to increment version');
  return nextVersion;
}

export function getNextReleaseVersion(updateType: 'patch' | 'minor') {
  const currentVersion = getCurrentVersion();
  switch (updateType) {
    case 'minor':
      return getNextMinorVersion(currentVersion);
    case 'patch':
      return getNextPatchVersion(currentVersion);
  }
  return currentVersion;
}
