import { ReleaseNoteData } from '../types';
import { getHeaderBySectionType, getSectionTypeByHeader, NEED_TO_DESCRIBE_HEADER } from './headers';
import { parseChanges } from './parseChanges';
import { convertChangesToString } from './convertChangesToString';

export function releaseNotesUpdater(currentBody: string) {
  let body = currentBody;

  const findNextHeaderPosition = (startIndex: number) => {
    const slicedBody = body.slice(startIndex);
    const endIndex = slicedBody.indexOf('## ');
    return endIndex !== -1 ? endIndex + startIndex : body.length;
  };

  const getReleaseNotesData = (): ReleaseNoteData[] => {
    const releaseNotesData: ReleaseNoteData[] = [];
    const sectionRegex = /## (.+)\r?\n([\s\S]*?)(?=##|$)/g;
    const matches = body.matchAll(sectionRegex);
    for (const match of matches) {
      const [, header, content] = match;
      const trimmedContent = content.trim();
      const typeByHeader = getSectionTypeByHeader(header);
      if (!typeByHeader) {
        continue;
      }

      releaseNotesData.push({
        type: typeByHeader,
        data: parseChanges(trimmedContent),
      });
    }

    return releaseNotesData;
  };

  const insertContentInSection = (
    header: string,
    calculateNewContent: (currentContent: string) => string,
  ) => {
    const startIndex = body.indexOf(header) + header.length;
    const endIndex = findNextHeaderPosition(startIndex);
    let currentContent = body.substring(startIndex, endIndex).trim();
    currentContent = calculateNewContent(currentContent);
    body = body.slice(0, startIndex) + '\r\n' + currentContent + '\r\n' + body.slice(endIndex);
  };

  const addNotes = ({
    noteData,
    version,
    author,
  }: {
    noteData: ReleaseNoteData;
    version: string;
    author?: string;
  }) => {
    const headerByType = getHeaderBySectionType(noteData.type);
    if (!headerByType) {
      return;
    }
    const headerWithFormatting = `## ${headerByType}`;
    if (body.includes(headerWithFormatting)) {
      insertContentInSection(headerWithFormatting, (currentContent) => {
        const currentSectionContentData = parseChanges(currentContent);
        currentSectionContentData.push(...noteData.data);
        return convertChangesToString(currentSectionContentData, version, author || '');
      });
    } else {
      body += `\r\n## ${getHeaderBySectionType(noteData.type)}\r\n`;
      body += convertChangesToString(noteData.data, version, author || '');
    }
  };

  const addUndescribedPRNumber = (prNumber: number) => {
    if (body.includes(NEED_TO_DESCRIBE_HEADER)) {
      insertContentInSection(NEED_TO_DESCRIBE_HEADER, (currentContent) => {
        currentContent += `\r\n#${prNumber}`;
        return currentContent;
      });
    } else {
      body += `\r\n## ${NEED_TO_DESCRIBE_HEADER}\r\n`;
      body += `#${prNumber}`;
    }
  };

  return {
    getBody: () => body,
    getReleaseNotesData,
    addUndescribedPRNumber,
    addNotes,
  };
}
