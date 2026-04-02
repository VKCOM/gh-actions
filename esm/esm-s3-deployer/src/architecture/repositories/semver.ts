import * as semver from 'semver';
import type { SemverRepository } from '../entities/repositories.ts';

export class Semver implements SemverRepository {
  maxSatisfying(versions: readonly string[], range: string): string | null {
    return semver.maxSatisfying(versions, range);
  }

  satisfies(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  major(version: string): string | null {
    const major = semver.major(version);

    if (!Number.isFinite(major)) return null;

    if (major !== 0) {
      return major.toString();
    }

    return `0.${semver.minor(version)}`;
  }

  latestByMajor(versions: readonly string[]): Map<string, string> {
    const majorToVersions = new Map<string, string>();

    versions.forEach((version) => {
      const major = this.major(version);
      if (major === null) return;

      const currentVersion = majorToVersions.get(major);
      if (currentVersion === undefined) {
        majorToVersions.set(major, version);
        return;
      }

      if (semver.gt(version, currentVersion)) {
        majorToVersions.set(major, version);
      }
    });

    return majorToVersions;
  }
}
