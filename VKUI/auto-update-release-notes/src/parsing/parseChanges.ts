import { ChangeData } from '../types';

const COMPONENT_REGEX = /-\s(\w+):(.+)?/;
const COMPONENT_WITH_LINK_REGEX = /-\s\[(\w+)]\(.+\):(.+)?/;
const COMPONENT_SUB_ITEM_REGEX = /\s{2}-\s(.+)/;
const UNKNOWN_CHANGE_REGEX = /-\s(.+)/;
const CODE_BLOCK_START_REGEX = /```(diff)?/;
const CODE_BLOCK_END_REGEX = /```/;

function removeLeadingSpaces(str: string, n: number): string {
  // Создаем регулярное выражение для проверки n пробелов в начале строки
  const regexStr = `^\\s{${n}}`;
  const regex = new RegExp(regexStr);
  return regex.test(str) ? str.slice(n) : str;
}

export function parseChanges(text: string): ChangeData[] {
  let changes: ChangeData[] = [];
  const lines = text.split(/\r?\n/);
  let currentChange: ChangeData | null = null;
  let codeBlockStarted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const componentMatch = line.match(COMPONENT_REGEX);
    const componentWithLinkMatch = line.match(COMPONENT_WITH_LINK_REGEX);
    const componentSubItemMatch = line.match(COMPONENT_SUB_ITEM_REGEX);
    const unknownChangeMatch = line.match(UNKNOWN_CHANGE_REGEX);
    const codeBlockStartMatch = line.match(CODE_BLOCK_START_REGEX);
    const codeBlockEndMatch: RegExpMatchArray | null = codeBlockStarted
      ? line.match(CODE_BLOCK_END_REGEX)
      : null;

    const addToAdditionalInfo = () => {
      if (currentChange) {
        const subInfo = currentChange.type === 'component' && currentChange.subInfo;
        currentChange.additionalInfo += `${removeLeadingSpaces(line, subInfo ? 4 : 2)}\r\n`;
      }
    };

    if (codeBlockStartMatch || codeBlockEndMatch) {
      codeBlockStarted = !codeBlockEndMatch;
      addToAdditionalInfo();
    } else if (codeBlockStarted) {
      addToAdditionalInfo();
    } else if (componentMatch || componentWithLinkMatch) {
      const match = componentMatch || componentWithLinkMatch;
      if (match) {
        const component = match[1];
        const description = match[2].trim();
        currentChange = {
          type: 'component',
          subInfo: false,
          component: component,
          description: description,
          additionalInfo: '',
        };
        changes.push(currentChange);
      }
    } else if (componentSubItemMatch && currentChange && currentChange.type === 'component') {
      // Описание для текущего компонента
      const description = componentSubItemMatch[1].trim();
      currentChange = {
        type: 'component',
        subInfo: true,
        component: currentChange.component,
        description: description,
        additionalInfo: '',
      };
      changes.push(currentChange);
    } else if (unknownChangeMatch) {
      // Неизвестное изменение
      const description = unknownChangeMatch[1].trim();
      currentChange = {
        type: 'unknown',
        description: description,
        additionalInfo: '',
      };
      changes.push(currentChange);
    } else if (currentChange) {
      addToAdditionalInfo();
    } else if (line) {
      // Если строка не пустая и не относится к текущему изменению,
      // создаем новое неизвестное изменение
      currentChange = {
        type: 'unknown',
        description: line,
        additionalInfo: '',
      };
      changes.push(currentChange);
    }
  }
  changes = changes.filter((change) => !!change.description);
  changes.forEach((change) => (change.additionalInfo = change.additionalInfo?.trim()));

  return changes;
}
