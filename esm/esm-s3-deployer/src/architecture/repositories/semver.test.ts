import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Semver } from './semver.ts';

describe('Semver', () => {
  const semver = new Semver();

  describe('maxSatisfying', () => {
    it('returns the highest version satisfying the range', () => {
      const versions = ['1.0.0', '1.2.0', '2.0.0', '2.1.0'];
      assert.equal(semver.maxSatisfying(versions, '^1.0.0'), '1.2.0');
      assert.equal(semver.maxSatisfying(versions, '^2.0.0'), '2.1.0');
    });

    it('returns null when no version satisfies the range', () => {
      const versions = ['1.0.0', '1.2.0'];
      assert.equal(semver.maxSatisfying(versions, '^2.0.0'), null);
    });

    it('returns null for empty versions array', () => {
      assert.equal(semver.maxSatisfying([], '^1.0.0'), null);
    });

    it('handles prerelease versions', () => {
      const versions = ['1.0.0-alpha', '1.0.0-beta', '1.0.0'];
      assert.equal(semver.maxSatisfying(versions, '^1.0.0'), '1.0.0');
    });

    it('handles complex ranges', () => {
      const versions = ['1.0.0', '1.5.0', '2.0.0'];
      assert.equal(semver.maxSatisfying(versions, '>=1.0.0 <2.0.0'), '1.5.0');
    });
  });

  describe('satisfies', () => {
    it('returns true when version satisfies the range', () => {
      assert.equal(semver.satisfies('1.2.3', '^1.0.0'), true);
      assert.equal(semver.satisfies('2.0.0', '>=2.0.0'), true);
      assert.equal(semver.satisfies('1.5.0', '1.x'), true);
    });

    it('returns false when version does not satisfy the range', () => {
      assert.equal(semver.satisfies('2.0.0', '^1.0.0'), false);
      assert.equal(semver.satisfies('1.0.0', '>=2.0.0'), false);
    });

    it('handles exact version match', () => {
      assert.equal(semver.satisfies('1.2.3', '1.2.3'), true);
      assert.equal(semver.satisfies('1.2.3', '1.2.4'), false);
    });

    it('handles tilde ranges', () => {
      assert.equal(semver.satisfies('1.2.5', '~1.2.3'), true);
      assert.equal(semver.satisfies('1.3.0', '~1.2.3'), false);
    });
  });

  describe('major', () => {
    it('returns major version for versions > 0.x', () => {
      assert.equal(semver.major('1.0.0'), '1');
      assert.equal(semver.major('2.5.3'), '2');
      assert.equal(semver.major('10.0.0'), '10');
    });

    it("returns '0.minor' for 0.x versions", () => {
      assert.equal(semver.major('0.1.0'), '0.1');
      assert.equal(semver.major('0.5.3'), '0.5');
      assert.equal(semver.major('0.0.1'), '0.0');
    });

    it('handles versions with build metadata', () => {
      assert.equal(semver.major('1.0.0+build'), '1');
      assert.equal(semver.major('0.1.0+build'), '0.1');
    });

    it('handles prerelease versions', () => {
      assert.equal(semver.major('1.0.0-alpha'), '1');
      assert.equal(semver.major('0.1.0-alpha'), '0.1');
    });
  });

  describe('latestByMajor', () => {
    it('returns the latest version for each major', () => {
      const versions = ['1.0.0', '1.5.0', '2.0.0', '2.1.0', '3.0.0'];
      const result = semver.latestByMajor(versions);

      assert.equal(result.size, 3);
      assert.equal(result.get('1'), '1.5.0');
      assert.equal(result.get('2'), '2.1.0');
      assert.equal(result.get('3'), '3.0.0');
    });

    it('handles 0.x versions with minor grouping', () => {
      const versions = ['0.1.0', '0.1.5', '0.2.0', '0.2.3'];
      const result = semver.latestByMajor(versions);

      assert.equal(result.size, 2);
      assert.equal(result.get('0.1'), '0.1.5');
      assert.equal(result.get('0.2'), '0.2.3');
    });

    it('returns empty map for empty versions array', () => {
      const result = semver.latestByMajor([]);
      assert.equal(result.size, 0);
    });

    it('handles mixed 0.x and regular versions', () => {
      const versions = ['0.1.0', '0.1.5', '1.0.0', '1.2.0'];
      const result = semver.latestByMajor(versions);

      assert.equal(result.size, 2);
      assert.equal(result.get('0.1'), '0.1.5');
      assert.equal(result.get('1'), '1.2.0');
    });

    it('handles prerelease versions', () => {
      const versions = ['1.0.0-alpha', '1.0.0-beta', '1.0.0'];
      const result = semver.latestByMajor(versions);

      assert.equal(result.size, 1);
      assert.equal(result.get('1'), '1.0.0');
    });
  });
});
