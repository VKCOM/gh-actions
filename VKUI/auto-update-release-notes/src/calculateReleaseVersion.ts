import { getNextReleaseVersion } from './getVersion';

export function calculateReleaseVersion({
  labels,
  milestone,
}: {
  labels: Array<{ name: string }>;
  milestone: { title: string } | null;
}) {
  const hasPatchLabel = labels.some((label) => label.name === 'patch');

  const nextReleaseVersion =
    milestone?.title || `v${getNextReleaseVersion(hasPatchLabel ? 'patch' : 'minor')}`;

  return nextReleaseVersion;
}
