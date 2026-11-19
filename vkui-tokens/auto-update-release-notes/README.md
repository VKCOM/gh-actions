## Auto update release notes for vkui-tokens

Экшен обновляет черновик релиза по секции `## Release notes` в описании PR.
Формат секций такой же, как в `VKUI/auto-update-release-notes`: `## Улучшения`,
`## Исправления`, `## Документация`, `## Зависимости`, `## Новые компоненты`
и `## BREAKING CHANGE`. К изменениям добавляется номер PR, а для PR из форка —
благодарность автору. Названия перед двоеточием группируются без ссылок на документацию VKUI.

Версия берётся из milestone PR или связанной через `Closes #123` issue.
Без milestone выбирается следующая minor-версия последнего опубликованного релиза.
Для patch-релиза нужно указать milestone, например `v4.93.3`; лейблы не используются.
Черновики называются `v<версия>`, как ожидает `vkui-tokens/publish-release-notes`.
Изменения для major-релиза также добавляются в существующий черновик его последнего RC.

Если секция содержит только `-`, PR пропускается. Если секции нет, но указан milestone,
номер PR добавляется в раздел «Нужно описать». Без секции и milestone PR пропускается.

### Использование

```yaml
on:
  pull_request_target:
    types: [closed]

permissions:
  contents: write
  pull-requests: read
  issues: read

concurrency:
  group: auto-update-release-notes
  cancel-in-progress: false

jobs:
  release_notes:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: VKCOM/gh-actions/vkui-tokens/auto-update-release-notes@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          pull_request_number: ${{ github.event.pull_request.number }}
```

Входные параметры `token` и `pull_request_number` обязательны. Токену нужны права
на чтение PR и issues, а также на запись релизов.
