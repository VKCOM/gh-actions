import type { ReleaseNoteData } from '../types.ts';
import { convertChangesToString } from './convertChangesToString.ts';
import {
  getHeaderBySectionType,
  getSectionTypeByHeader,
  NEED_TO_DESCRIBE_HEADER,
} from './headers.ts';
import { parseChanges } from './parseChanges.ts';

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
      const trimmedHeader = header.trim();
      const trimmedContent = content.trim();
      const typeByHeader = getSectionTypeByHeader(trimmedHeader);
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
    body = `${body.slice(0, startIndex)}\r\n${currentContent}\r\n${body.slice(endIndex)}`;
  };

  const addSectionWithContent = (header: string, content: string) => {
    body += `\r\n## ${header}\r\n`;
    body += content;
  };

  const addNotes = ({ noteData, version }: { noteData: ReleaseNoteData; version: string }) => {
    const headerByType = getHeaderBySectionType(noteData.type);
    if (!headerByType) {
      return;
    }
    const headerWithFormatting = `## ${headerByType}`;
    if (body.includes(headerWithFormatting)) {
      insertContentInSection(headerWithFormatting, (currentContent) => {
        const currentSectionContentData = parseChanges(currentContent);
        currentSectionContentData.push(...noteData.data);
        return convertChangesToString(currentSectionContentData, version);
      });
    } else {
      addSectionWithContent(headerByType, convertChangesToString(noteData.data, version));
    }
  };

  const addUndescribedPRNumber = (prNumber: number) => {
    const header = `## ${NEED_TO_DESCRIBE_HEADER}`;
    if (body.includes(header)) {
      insertContentInSection(NEED_TO_DESCRIBE_HEADER, (currentContent) => {
        currentContent += `\r\n#${prNumber}`;
        return currentContent;
      });
    } else {
      addSectionWithContent(NEED_TO_DESCRIBE_HEADER, `#${prNumber}`);
    }
  };

  return {
    getBody: () => body,
    getReleaseNotesData,
    addUndescribedPRNumber,
    addNotes,
  };
}
