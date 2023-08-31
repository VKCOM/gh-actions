export function getPatchInstructions(
  header: string,
  description: string,
  patch: { targetBranchRef: string; patchRefs: string[]; pullNumber: number },
) {
  const { targetBranchRef, patchRefs, pullNumber } = patch;

  return `
## ${header}

${description}

> Дальнейшие действия выполняют контрибьютеры из группы @VKCOM/vkui-core

Чтобы изменение попало в ветку ${targetBranchRef}, выполните следующие действия:

1. Создайте новую ветку от ${targetBranchRef} и примените изменения используя cherry-pick

\`\`\`bash
git stash # опционально
git fetch origin ${targetBranchRef}
git checkout -b patch/pr${pullNumber} origin/${targetBranchRef}

${patchRefs
  .map((pathRef) => {
    return [
      `git cherry-pick --no-commit ${pathRef}`,
      'git checkout HEAD **/__image_snapshots__/*.png',
      'git diff --quiet HEAD || git commit --no-verify --no-edit',
    ].join('\n');
  })
  .join('\n\n')}
\`\`\`

2. Исправьте конфликты, следуя инструкциям из терминала
3. Отправьте ветку на GitHub и создайте новый PR с веткой ${targetBranchRef} (установка лейбла не требуется!)

\`\`\`bash
git push --set-upstream origin patch/pr${pullNumber}
gh pr create --base ${targetBranchRef} --title "patch: pr${pullNumber}" --body "- patch #${pullNumber}"
\`\`\`
`;
}
