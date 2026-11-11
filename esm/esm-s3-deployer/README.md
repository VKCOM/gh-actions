# esm.cdn-vk.ru

esm.cdn-vk.ru позволяет импортировать JavaScript модули по URL .

```
import { Button } from "https://esm.cdn-vk.ru/@vkontakte/vkui@8.5.0/index.js";
```

С [import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap),
можно даже использовать привычные спецификаторы импорта вместо URL-адресов

```html
<script type="importmap">
  {
    "imports": {
      "@vkontakte/vkui": "https://esm.cdn-vk.ru/@vkontakte/vkui@8.5.0/index.js"
    }
  }
</script>
<script type="module">
  import { Button } from "@vkontakte/vkui"; // → https://esm.cdn-vk.ru/@vkontakte/vkui@8.5.0/index.js
</script>
```

### Формат URL и версии

```text
https://esm.cdn-vk.ru/<name>@<version>/index.js
https://esm.cdn-vk.ru/<name>@<version>/<subpath>.js
```

Для scoped-пакетов имя включает scope: `@vkontakte/icons`.

| Что подключаем                           | Пример пути на CDN                       |
| ---------------------------------------- | ---------------------------------------- |
| Основной модуль с точной версией         | `/@vkontakte/icons@3.80.0/index.js`      |
| Основной модуль через major alias        | `/@vkontakte/icons@3/index.js`           |
| Подпуть `./utils` условного пакета       | `/@scope/package-name@1.0.0/utils.js`    |
| Подпуть `./feature.mjs` условного пакета | `/@scope/package-name@1.0.0/feature.mjs` |

Точная версия в URL фиксирует версию самого пакета. При повторном деплое
его зависимости могут обновиться в пределах объявленных диапазонов.
Major alias (например, `@3`) обновляется при деплое на последнюю выбранную
версию этой major-линейки в пределах настроенного диапазона.

### CSS и другие файлы

Файлы из npm-архива доступны по исходным путям внутри каталога версии.
Пакеты без JavaScript-точки входа тоже публикуются: для них сборка пустая.
Например, если пакет содержит `dist/style.css`, подключите его отдельно:

```html
<link
  rel="stylesheet"
  href="https://esm.cdn-vk.ru/@scope/package-name@1.0.0/dist/style.css"
/>
```

Аналогично можно ссылаться на SVG и другие статические файлы. Файлы типов
тоже публикуются, но автоматическое подключение типов для URL-импортов
деплойер не настраивает.
