import { describe, expect, it } from '@jest/globals';
import { IconData } from './types';
import { releaseNotesParser } from './releaseNotesParser';

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
    testName: 'add some icons to release notes',
    body: `## Добавленные иконки

### add_circle_fill_red_16 (16)

![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)

### accessibility_outline_24 (24)

![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)

## Измененные иконки

### add_rectangle_line_16 (16)

![add_rectangle_line_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_rectangle_line_16.svg)

### add_rectangle_line_24 (24)

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
    resultBody: `## Добавленные иконки

### add_circle_fill_red_16 (16)

![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)

### bug_outline_16 (16)

![bug_outline_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/bug_outline_16.svg)

### accessibility_outline_24 (24)

![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)

### discount_outline_32 (32)

![discount_outline_32](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/32/discount_outline_32.svg)

## Измененные иконки

### add_rectangle_line_16 (16)

![add_rectangle_line_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_rectangle_line_16.svg)

### add_rectangle_line_24 (24)

![add_rectangle_line_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/add_rectangle_line_24.svg)

### calendar_outline_36 (36)

![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
  {
    testName: 'add some icons to not existed section',
    body: `## Добавленные иконки

### add_circle_fill_red_16 (16)

![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)

### accessibility_outline_24 (24)

![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)`,
    newData: [
      {
        title: 'Измененные иконки',
        icons: [generateIconData('calendar_outline_36')],
      },
    ],
    resultBody: `## Добавленные иконки

### add_circle_fill_red_16 (16)

![add_circle_fill_red_16](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/16/add_circle_fill_red_16.svg)

### accessibility_outline_24 (24)

![accessibility_outline_24](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/24/accessibility_outline_24.svg)

## Измененные иконки

### calendar_outline_36 (36)

![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
  {
    testName: 'add some icons to not existed section with some other sections',
    body: `## BREAKING CHANGE

### Переименование иконок

Иконки в названиях которых были опечатки переименованы (#1049):

- \`Icon16DonateOultine\` → \`Icon16DonateOutline\`
- \`Icon16InfoCirle\` → \`Icon16InfoCircle\`
- \`Icon20FolderSimpleArrowRightOutlune\` → \`Icon20FolderSimpleArrowRightOutline\`
- \`Icon20AppleWatchOutlite\` → \`Icon20AppleWatchOutline\`
- \`Icon24ChatVaweOutlineGray\` → \`Icon24ChatWaveOutlineGray\`
- \`Icon24RectrangleHandPointUp\` → \`Icon24RectangleHandPointUp\`
- \`Icon24PhoneVaweOutlineGray\` → \`Icon24PhoneWaveOutlineGray\`

### Отказ от системы спрайтов

Система спрайтов превентивно оптимизировало случаи, когда одна иконка могла использовать несколько раз на странице. C увеличением количества иконок в репозитории, обнаружилась обратная сторона этого решения – рендер спрайта занимает больше времени, чем если бы иконка рендерилась самостоятельно без спрайта. Помимо скорости рендера, нет поддержки SSR, т.к. спрайт собирается только на клиенте. Это приводит к проблеме с морганием иконок во время первого рендера.

- Спрайт был удален, вместо него иконка рендерится как есть (#1039)

### Обновление поддержки React

- Удалена поддержка **React 16** и **React 17** (#902)
- Добавлена поддержка **React 19** (#1048)

### Удаление CommonJS

На 2024 год многие сборщики, библиотеки и браузеры уже умеют в поддержку ESM.

- Удалена сборка CommonJS (#1043)

### Ограничение импортов

Импортирование теперь ограничено свойством \`"exports"\` в \`package.json\`. Если вам нужен какой-то внутренний функционал, то следует создать [issues](https://github.com/VKCOM/VKUI/issues/new/choose) на его экспорт, чтобы мы рассмотрели такую возможность (#1039).`,
    newData: [
      {
        title: 'Измененные иконки',
        icons: [generateIconData('calendar_outline_36')],
      },
    ],
    resultBody: `## BREAKING CHANGE

### Переименование иконок

Иконки в названиях которых были опечатки переименованы (#1049):

- \`Icon16DonateOultine\` → \`Icon16DonateOutline\`
- \`Icon16InfoCirle\` → \`Icon16InfoCircle\`
- \`Icon20FolderSimpleArrowRightOutlune\` → \`Icon20FolderSimpleArrowRightOutline\`
- \`Icon20AppleWatchOutlite\` → \`Icon20AppleWatchOutline\`
- \`Icon24ChatVaweOutlineGray\` → \`Icon24ChatWaveOutlineGray\`
- \`Icon24RectrangleHandPointUp\` → \`Icon24RectangleHandPointUp\`
- \`Icon24PhoneVaweOutlineGray\` → \`Icon24PhoneWaveOutlineGray\`

### Отказ от системы спрайтов

Система спрайтов превентивно оптимизировало случаи, когда одна иконка могла использовать несколько раз на странице. C увеличением количества иконок в репозитории, обнаружилась обратная сторона этого решения – рендер спрайта занимает больше времени, чем если бы иконка рендерилась самостоятельно без спрайта. Помимо скорости рендера, нет поддержки SSR, т.к. спрайт собирается только на клиенте. Это приводит к проблеме с морганием иконок во время первого рендера.

- Спрайт был удален, вместо него иконка рендерится как есть (#1039)

### Обновление поддержки React

- Удалена поддержка **React 16** и **React 17** (#902)
- Добавлена поддержка **React 19** (#1048)

### Удаление CommonJS

На 2024 год многие сборщики, библиотеки и браузеры уже умеют в поддержку ESM.

- Удалена сборка CommonJS (#1043)

### Ограничение импортов

Импортирование теперь ограничено свойством \`"exports"\` в \`package.json\`. Если вам нужен какой-то внутренний функционал, то следует создать [issues](https://github.com/VKCOM/VKUI/issues/new/choose) на его экспорт, чтобы мы рассмотрели такую возможность (#1039).

## Измененные иконки

### calendar_outline_36 (36)

![calendar_outline_36](https://raw.githubusercontent.com/your-org/your-repo/commit-sha/packages/icons/src/svg/36/calendar_outline_36.svg)`,
  },
];

describe('releaseNotesParser', () => {
  fixtures.forEach(({ testName, newData, resultBody, body }) => {
    it(testName, () => {
      const parser = releaseNotesParser(body);
      newData.forEach((data) => {
        parser.modifySection(data.title, data.icons);
      });
      const resBody = parser.body;

      expect(resBody).toEqual(resultBody);
    });
  });
});
