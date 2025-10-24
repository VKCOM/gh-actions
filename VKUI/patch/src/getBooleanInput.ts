import * as core from '@actions/core';

const trueValue = ['true', 'True', 'TRUE'];
const falseValue = ['false', 'False', 'FALSE'];

/**
 * Исправленная версия getBooleanInput функции из `@actions/core`.
 *
 * [getBooleanInput ignores options.required](https://github.com/actions/toolkit/issues/844)
 */
export function getBooleanInput(name: string, options?: core.InputOptions): boolean {
  const val = core.getInput(name, options);

  if (!val) {
    return false;
  }
  if (trueValue.includes(val)) {
    return true;
  }
  if (falseValue.includes(val)) {
    return false;
  }

  throw new TypeError(
    `Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
      `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``,
  );
}
