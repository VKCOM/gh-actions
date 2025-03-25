import { ChangeData } from '../types';

const COMPONENT_REGEX = /-\s(\w+):(.+)?/;
const COMPONENT_WITH_LINK_REGEX = /-\s\[(\w+)]\(.+\):(.+)?/;
const COMPONENT_SUB_ITEM_REGEX = /\s{2}-\s(.+)/;
const UNKNOWN_CHANGE_REGEX = /-\s(.+)/;
const CODE_BLOCK_START_REGEX = /```(diff)?/;
const CODE_BLOCK_END_REGEX = /```/;
const PR_NUMBER_REGEX = /^(.+)\(#(\d+)\)$/;
const PR_WITH_AUTHOR_REGEX = /^(.+)\(#(\d+),\s+спасибо\s+@(\w+)\)$/;

function removeLeadingSpaces(str: string, n: number): string {
  const spaceRegex = /^(\s+)/;
  const match = str.match(spaceRegex);
  if (!match || !match[1]) {
    return str;
  }
  const leadingSpacesCount = match[1].length;
  return str.slice(Math.min(leadingSpacesCount, n));
}

function resolveDescription(
  fullDescription: string,
): Pick<ChangeData, 'description' | 'pullRequestNumber' | 'author'> {
  const description = fullDescription.trim();
  const descriptionWithPrNumberMatch = description.match(PR_NUMBER_REGEX);
  const descriptionWithAuthorNumberMatch = description.match(PR_WITH_AUTHOR_REGEX);

  if (descriptionWithAuthorNumberMatch) {
    const descriptionBody = descriptionWithAuthorNumberMatch[1];
    const prNumber = descriptionWithAuthorNumberMatch[2];
    const author = descriptionWithAuthorNumberMatch[3];
    return {
      description: descriptionBody,
      pullRequestNumber: Number(prNumber),
      author,
    };
  }
  if (descriptionWithPrNumberMatch) {
    const descriptionBody = descriptionWithPrNumberMatch[1];
    const prNumber = descriptionWithPrNumberMatch[2];
    return {
      description: descriptionBody,
      pullRequestNumber: Number(prNumber),
    };
  }
  return {
    description,
  };
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
        const description = match[2] || '';
        currentChange = {
          type: 'component',
          subInfo: false,
          component: component,
          additionalInfo: '',
          ...resolveDescription(description),
        };
        changes.push(currentChange);
      }
    } else if (componentSubItemMatch && currentChange && currentChange.type === 'component') {
      // Описание для текущего компонента
      const description = componentSubItemMatch[1];
      currentChange = {
        type: 'component',
        subInfo: true,
        component: currentChange.component,
        additionalInfo: '',
        ...resolveDescription(description),
      };
      changes.push(currentChange);
    } else if (unknownChangeMatch) {
      // Неизвестное изменение
      const description = unknownChangeMatch[1];
      currentChange = {
        type: 'unknown',
        additionalInfo: '',
        ...resolveDescription(description),
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
