/* eslint-disable @typescript-eslint/no-floating-promises -- node тесты */
import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { IconData } from './types.ts';
import { releaseNotesParser } from './releaseNotesParser.ts';

function findSize(input: string): string {
  const match = input.match(/-?\d+/);
  return match ? match[0] : '';
}

const generateIconData = (name: string): IconData => {
  const size = findSize(name);
  return {
    name,
    size,
    url: `https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/${size}/${name}.svg`,
  };
};

const fixtures = [
  {
    testName: 'Добавляем иконки в уже созданные секции',
    body: `## Добавленные иконки\r
\r
### add_circle_fill_red_16\r
\r
![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)\r
\r
### accessibility_outline_24\r
\r
![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)\r
\r
## Измененные иконки\r
\r
### add_rectangle_line_16\r
\r
![add_rectangle_line_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_rectangle_line_16.svg)\r
\r
### add_rectangle_line_24\r
\r
![add_rectangle_line_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/add_rectangle_line_24.svg)`,
    newData: [
      {
        title: 'Добавленные иконки',
        icons: [generateIconData('bug_outline_16'), generateIconData('discount_outline_32')],
      },
      {
        title: 'Измененные иконки',
        icons: [generateIconData('calendar_outline_36')],
      },
    ],
    resultBody: `## Добавленные иконки\r
\r
### add_circle_fill_red_16\r
\r
![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)\r
\r
### bug_outline_16\r
\r
![bug_outline_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/bug_outline_16.svg)\r
\r
### accessibility_outline_24\r
\r
![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)\r
\r
### discount_outline_32\r
\r
![discount_outline_32](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/32/discount_outline_32.svg)\r
\r
## Измененные иконки\r
\r
### add_rectangle_line_16\r
\r
![add_rectangle_line_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_rectangle_line_16.svg)\r
\r
### add_rectangle_line_24\r
\r
![add_rectangle_line_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/add_rectangle_line_24.svg)\r
\r
### calendar_outline_36\r
\r
![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
  {
    testName: 'Добавляем иконки в несозданные секции',
    body: `## Добавленные иконки\r
\r
### add_circle_fill_red_16\r
\r
![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)\r
\r
### accessibility_outline_24\r
\r
![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)`,
    newData: [
      {
        title: 'Измененные иконки',
        icons: [generateIconData('calendar_outline_36')],
      },
    ],
    resultBody: `## Добавленные иконки\r
\r
### add_circle_fill_red_16\r
\r
![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)\r
\r
### accessibility_outline_24\r
\r
![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)\r
\r
## Измененные иконки\r
\r
### calendar_outline_36\r
\r
![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
  {
    testName:
      'Добавляем иконки в несозданные секции, когда при этом есть другие не сгенерированные секции',
    body: `## BREAKING CHANGE\r
\r
### Переименование иконок\r
\r
Иконки в названиях которых были опечатки переименованы (#1049):\r
\r
- \`Icon16DonateOultine\` → \`Icon16DonateOutline\`\r
- \`Icon16InfoCirle\` → \`Icon16InfoCircle\`\r
- \`Icon20FolderSimpleArrowRightOutlune\` → \`Icon20FolderSimpleArrowRightOutline\`\r
- \`Icon20AppleWatchOutlite\` → \`Icon20AppleWatchOutline\`\r
- \`Icon24ChatVaweOutlineGray\` → \`Icon24ChatWaveOutlineGray\`\r
- \`Icon24RectrangleHandPointUp\` → \`Icon24RectangleHandPointUp\`\r
- \`Icon24PhoneVaweOutlineGray\` → \`Icon24PhoneWaveOutlineGray\`\r
\r
### Отказ от системы спрайтов\r
\r
Система спрайтов превентивно оптимизировало случаи, когда одна иконка могла использовать несколько раз на странице. C увеличением количества иконок в репозитории, обнаружилась обратная сторона этого решения – рендер спрайта занимает больше времени, чем если бы иконка рендерилась самостоятельно без спрайта. Помимо скорости рендера, нет поддержки SSR, т.к. спрайт собирается только на клиенте. Это приводит к проблеме с морганием иконок во время первого рендера.\r
\r
- Спрайт был удален, вместо него иконка рендерится как есть (#1039)\r
\r
### Обновление поддержки React\r
\r
- Удалена поддержка **React 16** и **React 17** (#902)\r
- Добавлена поддержка **React 19** (#1048)\r
\r
### Удаление CommonJS\r
\r
На 2024 год многие сборщики, библиотеки и браузеры уже умеют в поддержку ESM.\r
\r
- Удалена сборка CommonJS (#1043)\r
\r
### Ограничение импортов\r
\r
Импортирование теперь ограничено свойством \`"exports"\` в \`package.json\`. Если вам нужен какой-то внутренний функционал, то следует создать [issues](https://github.com/VKCOM/VKUI/issues/new/choose) на его экспорт, чтобы мы рассмотрели такую возможность (#1039).`,
    newData: [
      {
        title: 'Измененные иконки',
        icons: [generateIconData('calendar_outline_36')],
      },
    ],
    resultBody: `## BREAKING CHANGE\r
\r
### Переименование иконок\r
\r
Иконки в названиях которых были опечатки переименованы (#1049):\r
\r
- \`Icon16DonateOultine\` → \`Icon16DonateOutline\`\r
- \`Icon16InfoCirle\` → \`Icon16InfoCircle\`\r
- \`Icon20FolderSimpleArrowRightOutlune\` → \`Icon20FolderSimpleArrowRightOutline\`\r
- \`Icon20AppleWatchOutlite\` → \`Icon20AppleWatchOutline\`\r
- \`Icon24ChatVaweOutlineGray\` → \`Icon24ChatWaveOutlineGray\`\r
- \`Icon24RectrangleHandPointUp\` → \`Icon24RectangleHandPointUp\`\r
- \`Icon24PhoneVaweOutlineGray\` → \`Icon24PhoneWaveOutlineGray\`\r
\r
### Отказ от системы спрайтов\r
\r
Система спрайтов превентивно оптимизировало случаи, когда одна иконка могла использовать несколько раз на странице. C увеличением количества иконок в репозитории, обнаружилась обратная сторона этого решения – рендер спрайта занимает больше времени, чем если бы иконка рендерилась самостоятельно без спрайта. Помимо скорости рендера, нет поддержки SSR, т.к. спрайт собирается только на клиенте. Это приводит к проблеме с морганием иконок во время первого рендера.\r
\r
- Спрайт был удален, вместо него иконка рендерится как есть (#1039)\r
\r
### Обновление поддержки React\r
\r
- Удалена поддержка **React 16** и **React 17** (#902)\r
- Добавлена поддержка **React 19** (#1048)\r
\r
### Удаление CommonJS\r
\r
На 2024 год многие сборщики, библиотеки и браузеры уже умеют в поддержку ESM.\r
\r
- Удалена сборка CommonJS (#1043)\r
\r
### Ограничение импортов\r
\r
Импортирование теперь ограничено свойством \`"exports"\` в \`package.json\`. Если вам нужен какой-то внутренний функционал, то следует создать [issues](https://github.com/VKCOM/VKUI/issues/new/choose) на его экспорт, чтобы мы рассмотрели такую возможность (#1039).\r
\r
## Измененные иконки\r
\r
### calendar_outline_36\r
\r
![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
];

describe('releaseNotesParser', () => {
  fixtures.forEach(({ testName, newData, resultBody, body }) => {
    test(testName, () => {
      const parser = releaseNotesParser(body);
      newData.forEach((data) => {
        parser.modifySection(data.title, data.icons);
      });
      const resBody = parser.body;

      assert.strictEqual(resBody, resultBody);
    });
  });
});
