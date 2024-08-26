import semver from 'semver';

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

export function getNextReleaseVersion(currentVKUIVersion: string, updateType: 'patch' | 'minor') {
  switch (updateType) {
    case 'minor':
      return getNextMinorVersion(currentVKUIVersion);
    case 'patch':
      return getNextPatchVersion(currentVKUIVersion);
  }
  return currentVKUIVersion;
}
