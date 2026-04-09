import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLabelsByChangedFiles } from './labels.ts';

describe('getLabelsByChangedFiles', () => {
  it('detects components, hooks and static labels', () => {
    const labels = getLabelsByChangedFiles([
      'packages/vkui/src/components/ChipsInput/ChipsInput.tsx',
      'packages/vkui/src/components/ChipsSelect/ChipsInputInput.tsx',
      'packages/vkui/src/hooks/useModalManager/useModalManager.ts',
      'packages/vkui/src/hooks/usePagination.ts',
      'website/content/button.mdx',
      '.github/workflows/ci.yml',
      'packages/vkui/package.json',
      'packages/codemods/src/main.ts',
      'packages/vkui-floating-ui/src/index.ts',
    ]);

    assert.deepEqual(labels, [
      'cmp:chips-input',
      'cmp:chips-select',
      'dependencies',
      'docs',
      'github_actions',
      'hook:use-modal-manager',
      'hook:use-pagination',
      'subpackage:@vkontakte/vkui-codemods',
      'subpackage:@vkontakte/vkui-floating-ui',
    ]);
  });

  it('supports hooks in nested directory', () => {
    const labels = getLabelsByChangedFiles([
      'packages/vkui/src/hooks/useCalendar/useCalendar.ts',
      'packages/vkui/src/hooks/useCalendar/helpers.ts',
    ]);

    assert.deepEqual(labels, ['hook:use-calendar']);
  });
});
