import type { IconData } from './types.ts';

function findNumber(input: string): string {
  const match = input.match(/-?\d+/);
  return match ? match[0] : '';
}

export function releaseNotesParser(body: string) {
  const parseIconsFromSection = (sectionTitle: string) => {
    const sectionStart = body.indexOf(`## ${sectionTitle}`);
    if (sectionStart === -1) {
      return [];
    }

    const nextSectionStart = body.indexOf('\r\n## ', sectionStart + 1);
    const sectionEnd = nextSectionStart !== -1 ? nextSectionStart : body.length;
    const sectionContent = body.substring(sectionStart + sectionTitle.length + 3, sectionEnd);

    const icons: IconData[] = [];
    const iconRegex = /### (.+?)\s+!\[.*?\]\((.+?)\)/g;
    let match: RegExpExecArray | null = iconRegex.exec(sectionContent);

    while (match !== null) {
      icons.push({
        name: match[1],
        size: findNumber(match[1]),
        url: match[2],
      });
      match = iconRegex.exec(sectionContent);
    }

    return icons;
  };

  const uniqueIcons = (icons: IconData[]): IconData[] => {
    const unique = new Map();
    icons.forEach((icon) => {
      const key = `${icon.name}-${icon.size}`;
      if (!unique.has(key)) {
        unique.set(key, icon);
      }
    });
    return Array.from(unique.values());
  };

  const generateSectionContent = (icons: IconData[], title: string) => {
    if (icons.length === 0) {
      return '';
    }

    icons.sort((a, b) => {
      if (a.size !== b.size) {
        return parseInt(a.size, 10) - parseInt(b.size, 10);
      }
      return a.name.localeCompare(b.name);
    });

    const content = icons
      .map((icon) => `### ${icon.name}\r\n\r\n![${icon.name}](${icon.url})`)
      .join('\r\n\r\n');

    return `## ${title}\r\n\r\n${content}\r\n`;
  };

  const updateSection = (sectionContent: string, sectionTitle: string) => {
    if (!sectionContent) {
      return body;
    }

    const sectionHeader = `## ${sectionTitle}`;
    const sectionRegex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\r\\n## |$)`, 'g');

    if (sectionRegex.test(body)) {
      body = body.replace(sectionRegex, sectionContent);
    } else {
      body += `\r\n\r\n${sectionContent}`;
    }
  };

  const modifySection = (sectionTitle: string, icons: IconData[]) => {
    const existingSectionIcons = parseIconsFromSection(sectionTitle);
    const allSectionIcons = uniqueIcons([...existingSectionIcons, ...icons]);
    const newSectionContent = generateSectionContent(allSectionIcons, sectionTitle);
    updateSection(newSectionContent, sectionTitle);
  };

  return {
    modifySection,
    get body() {
      body = body.trim().replace(/\r\n\r\n\r\n+/g, '\r\n\r\n');
      return body;
    },
  };
}
