# auto-label-pull-request

Автоматически определяет и добавляет labels в pull request.

## Inputs

- `token` - GitHub token с правами на чтение/запись PR labels.
- `pr-number` - номер PR

## Что делает

- Получает измененные файлы PR через GitHub API.
- Генерирует labels по путям:
  - `cmp:*`, `hook:*`, `docs`, `dependencies`, `github_actions`
  - `subpackage:@vkontakte/vkui-codemods`, `subpackage:@vkontakte/vkui-floating-ui`
- Добавляет бизнес-лейблы:
  - `ci:cherry-pick:patch`, если заголовок PR начинается с `fix`
  - `vkui-tokens`, если автор `dependabot[bot]` и заголовок содержит `@vkontakte/vkui-tokens`
- Фильтрует несуществующие labels в репозитории.
- Добавляет итоговый список labels в PR.

## Пример использования

```yaml
- id: auto-labels
  uses: ./VKUI/auto-label-pull-request
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```