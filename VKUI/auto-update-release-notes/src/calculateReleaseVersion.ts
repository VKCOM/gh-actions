import { getNextReleaseVersion } from './getVersion';

export function calculateReleaseVersion({
  labels,
  milestone,
  currentVKUIVersion,
}: {
  labels: Array<{ name: string }>;
  milestone: { title: string } | null;
  currentVKUIVersion: string;
}) {
  const hasPatchLabel = labels.some((label) => label.name === 'patch');

  const nextReleaseVersion =
    milestone?.title ||
    `v${getNextReleaseVersion(currentVKUIVersion, hasPatchLabel ? 'patch' : 'minor')}`;

  return nextReleaseVersion;
}
