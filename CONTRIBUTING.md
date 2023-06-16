## Разработка

В корне находятся папки репозиториев. Например, папка `VKUI` предназначена для
https://github.com/VKCOM/VKUI.
В папках находятся отдельные экшоны.

### Шаги разработки

1. Склонируйте репозиторий и перейдите в созданную директорию.
2. Установите зависимости: `yarn install`.
3. Напишите код, документацию и [тесты](https://nodejs.org/api/test.html)
4. Проверьте код `yarn lint && yarn test`
5. Создайте Pull Request в ветку `main`
6. Получите все апрувы
7. Замержите PR используя **Squash and merge**

Собирать экшоны не обязательно. При попадании в кода в мастер пакеты сами
пересобираются.

### Новый репозиторий

При создании новой папки репозитория, добавьте ее в
[.github/CODEOWNERS](.github/CODEOWNERS) и команду, которая отвечает за
репозиторий

```CODEOWNERS
VKUI/*                  @VKCOM/vkui-core
```

В файл [package.json](package.json) добавьте новый
["workspace"](https://classic.yarnpkg.com/lang/en/docs/workspaces/)

```json
  "workspaces": {
    "packages": [
      "VKUI/*"
    ]
  },
```
