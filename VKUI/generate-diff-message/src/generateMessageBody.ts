const MAX_VISIBLE_FILES_COUNT = 5;

const TABLE_HEADER = `| Файл | Статус |\n|----|----|\n`;

const FILE_STATUS_LABEL = {
  A: '✨ Добавлен',
  M: '✏️ Изменен',
  D: '❌️ Удален',
};

type FileType = {
  status: 'A' | 'M' | 'D';
  path: string[];
  extension: string;
};

const filesExtensionsOrder = ['.js', '.ts', '.css'];

function parseChangeString(input: string): FileType {
  const regex = /^([A-Z])[\t\s]+(.+)$/;
  const match = input.match(regex);

  const path = match?.[2].split('/').slice(1) as string[];
  const fileName = path[path.length - 1];
  const extension = fileName.substring(fileName.lastIndexOf('.'));

  return {
    status: match?.[1] as 'A' | 'M' | 'D',
    path,
    extension,
  };
}

export function generateMessageBody(changedFilesTxt: string, diffReportUrl: string) {
  const files: FileType[] = changedFilesTxt
    .split('\n')
    .filter((row) => row.trim())
    .map(parseChangeString)
    .filter((file) => !file.path[file.path.length - 1].includes('.map'))
    .sort((file1, file2) => {
      if (file1.path.length !== file2.path.length) {
        return file1.path.length - file2.path.length;
      }
      return (
        filesExtensionsOrder.indexOf(file1.extension) -
        filesExtensionsOrder.indexOf(file2.extension)
      );
    });

  if (!files.length) {
    return '';
  }

  let result = files.slice(0, MAX_VISIBLE_FILES_COUNT).reduce((res, file) => {
    return res + `| ${file.path.join('/')} | ${FILE_STATUS_LABEL[file.status]} |\n`;
  }, TABLE_HEADER);

  if (files.length > MAX_VISIBLE_FILES_COUNT) {
    result += `\nИ еще ${files.slice(MAX_VISIBLE_FILES_COUNT).length} файлов.\n`;
  }

  result += `\nПолный отчет вы можете посмотреть по [ссылке](${diffReportUrl})`;

  return result;
}
