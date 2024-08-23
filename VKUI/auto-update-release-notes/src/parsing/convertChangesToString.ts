import { ChangeData } from '../types';

const componentToString = (component: string, version: string) => {
  return `[${component}](https://vkcom.github.io/VKUI/${version}/#/${component})`;
};

const prAuthorToString = (author: string) => {
  return author ? `, спасибо @${author}` : '';
};

const pullRequestNumberToString = (prNumber: number | undefined, author: string) => {
  return prNumber ? ` (#${prNumber}${prAuthorToString(author)})` : '';
};

export const convertChangesToString = (
  changes: ChangeData[],
  version: string,
  author: string,
): string => {
  let result = '';
  const filteredChanges: ChangeData[] = [];
  const mapComponentToChanges: Map<string, ChangeData[]> = new Map();

  // Группируем пункты одинаковых компонентов в элемент мапы
  changes.forEach((change) => {
    if (change.type === 'component') {
      const componentChanges = mapComponentToChanges.get(change.component);
      if (!componentChanges) {
        filteredChanges.push(change);
        mapComponentToChanges.set(change.component, [change]);
      } else {
        componentChanges.push(change);
      }
    } else {
      filteredChanges.push(change);
    }
  });

  filteredChanges.forEach((change) => {
    if (change.type === 'component') {
      const componentChanges = mapComponentToChanges.get(change.component);
      if (!componentChanges) {
        return;
      }
      result += `- ${componentToString(change.component, version)}:`;
      if (componentChanges.length > 1) {
        result += '\n';
        componentChanges.forEach((changeItem) => {
          result += `  - ${changeItem.description}${pullRequestNumberToString(changeItem.pullRequestNumber, author)}\n`;
          if (changeItem.additionalInfo) {
            result += `${changeItem.additionalInfo}\n`;
          }
        });
      } else {
        result += ` ${change.description}${pullRequestNumberToString(change.pullRequestNumber, author)}\n`;
      }
    } else {
      result += `- ${change.description}${pullRequestNumberToString(change.pullRequestNumber, author)}\n`;
      if (change.additionalInfo) {
        result += `${change.additionalInfo}\n`;
      }
    }
  });

  return result;
};
