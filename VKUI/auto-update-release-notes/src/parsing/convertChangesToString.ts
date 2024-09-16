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

const changeDescriptionToString = (changeItem: ChangeData, author: string) => {
  return ` ${changeItem.description}${pullRequestNumberToString(changeItem.pullRequestNumber, author)}`;
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

  const addAdditionalInfo = (change: ChangeData, offsetLevel: number) => {
    const offsetStr = ' '.repeat(offsetLevel * 2);
    if (change.additionalInfo) {
      change.additionalInfo.split(/\r?\n/).forEach((line) => {
        result += `${offsetStr}${line}\r\n`;
      });
    }
  };

  filteredChanges.forEach((change) => {
    if (change.type === 'component') {
      const componentChanges = mapComponentToChanges.get(change.component);
      if (!componentChanges) {
        return;
      }
      result += `- ${componentToString(change.component, version)}:`;
      if (componentChanges.length > 1) {
        result += '\r\n';
        componentChanges.forEach((changeItem) => {
          result += `  -${changeDescriptionToString(changeItem, author)}\r\n`;
          addAdditionalInfo(changeItem, 2);
        });
      } else {
        result += `${changeDescriptionToString(change, author)}\r\n`;
        addAdditionalInfo(change, 1);
      }
    } else {
      result += `-${changeDescriptionToString(change, author)}\r\n`;
      addAdditionalInfo(change, 1);
    }
  });

  return result;
};
