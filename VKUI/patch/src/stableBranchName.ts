import type { SemVer } from 'semver';

export function stableBranchName(semVer: SemVer) {
  return `${semVer.major}.${semVer.minor}-stable`;
}
