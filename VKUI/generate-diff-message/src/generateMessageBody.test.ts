import { describe, expect, it } from '@jest/globals';
import { generateMessageBody } from './generateMessageBody';

const fixtures = [
  {
    name: 'Проверяем на большом количестве измененных файлов',
    input: `
M\tdist-1/components/AppRoot/AppRoot.d.ts.map
M\tdist-1/components/AppRoot/AppRoot.js
M\tdist-1/components/AppRoot/AppRoot.js.map
A\tdist/components/AppRoot/ModalContext.d.ts
A\tdist/components/AppRoot/ModalContext.d.ts.map
A\tdist/components/AppRoot/ModalContext.js
A\tdist/components/AppRoot/ModalContext.js.map
M\tdist-1/components/ModalOverlay/ModalOverlay.d.ts
M\tdist-1/components/ModalOverlay/ModalOverlay.d.ts.map
M\tdist-1/components/ModalOverlay/ModalOverlay.js
M\tdist-1/components/ModalOverlay/ModalOverlay.js.map
M\tdist-1/components/ModalRoot/ModalRoot.d.ts
M\tdist-1/components/ModalRoot/ModalRoot.d.ts.map
M\tdist-1/components/ModalRoot/ModalRoot.js
M\tdist-1/components/ModalRoot/ModalRoot.js.map
M\tdist-1/components/ModalRoot/types.d.ts
M\tdist-1/components/ModalRoot/types.d.ts.map
M\tdist-1/components/ModalRoot/types.js.map
M\tdist-1/components.css
M\tdist-1/components.css.map
M\tdist-1/cssm/components/AppRoot/AppRoot.js
M\tdist-1/cssm/components/AppRoot/AppRoot.js.map
A\tdist/cssm/components/AppRoot/ModalContext.js
A\tdist/cssm/components/AppRoot/ModalContext.js.map
M\tdist-1/cssm/components/ModalOverlay/ModalOverlay.js
M\tdist-1/cssm/components/ModalOverlay/ModalOverlay.js.map
M\tdist-1/cssm/components/ModalRoot/ModalRoot.js
M\tdist-1/cssm/components/ModalRoot/ModalRoot.js.map
M\tdist-1/cssm/components/ModalRoot/types.js.map
A\tdist/cssm/hooks/useModalRoot/index.js
A\tdist/cssm/hooks/useModalRoot/index.js.map
A\tdist/cssm/hooks/useModalRoot/types.js
A\tdist/cssm/hooks/useModalRoot/types.js.map
A\tdist/cssm/hooks/useModalRoot/useModalRoot.js
A\tdist/cssm/hooks/useModalRoot/useModalRoot.js.map
M\tdist-1/cssm/index.js
M\tdist-1/cssm/index.js.map
A\tdist/hooks/useModalRoot/index.d.ts
A\tdist/hooks/useModalRoot/index.d.ts.map
A\tdist/hooks/useModalRoot/index.js
A\tdist/hooks/useModalRoot/index.js.map
A\tdist/hooks/useModalRoot/types.d.ts
A\tdist/hooks/useModalRoot/types.d.ts.map
A\tdist/hooks/useModalRoot/types.js
A\tdist/hooks/useModalRoot/types.js.map
A\tdist/hooks/useModalRoot/useModalRoot.d.ts
A\tdist/hooks/useModalRoot/useModalRoot.d.ts.map
A\tdist/hooks/useModalRoot/useModalRoot.js
A\tdist/hooks/useModalRoot/useModalRoot.js.map
M\tdist-1/index.d.ts
M\tdist-1/index.d.ts.map
M\tdist-1/index.js
M\tdist-1/index.js.map
M\tdist-1/vkui.css
M\tdist-1/vkui.css.map
`,
    output: `| Файл | Статус |
|----|----|
| \`index.js\` | ✏️ Изменен |
| \`index.d.ts\` | ✏️ Изменен |
| \`components.css\` | ✏️ Изменен |
| \`vkui.css\` | ✏️ Изменен |
| \`cssm/index.js\` | ✏️ Изменен |

И еще 21 файлов.

Полный отчет вы можете посмотреть по [ссылке](https://diff-report.html)`,
  },
  {
    name: 'Проверяем на маленьком количестве измененных файлов',
    input: `
M\tdist-1/components.css
M\tdist-1/components.css.map
D\tdist-1/cssm/index.js
M\tdist-1/cssm/index.js.map
M\tdist-1/index.d.ts
M\tdist-1/index.d.ts.map
A\tdist-1/index.js
M\tdist-1/index.js.map
M\tdist-1/vkui.css
M\tdist-1/vkui.css.map
`,
    output: `| Файл | Статус |
|----|----|
| \`index.js\` | ✨ Добавлен |
| \`index.d.ts\` | ✏️ Изменен |
| \`components.css\` | ✏️ Изменен |
| \`vkui.css\` | ✏️ Изменен |
| \`cssm/index.js\` | ❌️ Удален |

Полный отчет вы можете посмотреть по [ссылке](https://diff-report.html)`,
  },
];

describe('generateMessageBody', () => {
  fixtures.forEach((fixture) => {
    it(fixture.name, () => {
      expect(generateMessageBody(fixture.input, 'https://diff-report.html')).toEqual(
        fixture.output,
      );
    });
  });
});
