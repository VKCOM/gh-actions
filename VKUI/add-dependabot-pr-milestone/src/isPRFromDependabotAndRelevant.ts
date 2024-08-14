import { WebhookPayload } from '@actions/github/lib/interfaces';

// Проверяет, является ли PR от Dependabot и затрагивает ли нужные зависимости
export function isPRFromDependabotAndRelevant(
  pullRequest: Exclude<WebhookPayload['pull_request'], undefined>,
): boolean {
  if (pullRequest.user.login !== 'dependabot[bot]') return false;

  const relevantDependencies = ['@swc/helpers', '@vkontakte/icons', '@vkontakte/vkjs', 'date-fns'];
  const packageJsonPath = 'packages/vkui/package.json';

  const files = pullRequest.files || [];
  const packageJsonFile = files.find((file: any) => file.filename === packageJsonPath);

  if (!packageJsonFile) return false;

  // Получаем содержимое измененного файла package.json
  const patchContent = packageJsonFile.patch || '';

  // Проверяем, содержит ли патч изменения для relevant dependencies
  return relevantDependencies.some(
    (dep) => patchContent.includes(`"${dep}": "`) || patchContent.includes(`"${dep}":`),
  );
}
