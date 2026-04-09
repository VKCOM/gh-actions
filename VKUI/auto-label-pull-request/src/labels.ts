import path from 'node:path';

const dependencyFileNames = new Set(['package.json', 'yarn.lock', 'package-lock.json']);

function normalizePath(filePath: string): string {
  return filePath
    .trim()
    .replaceAll('\\', '/')
    .replace(/^["']|["']$/g, '');
}

function stripExtension(fileOrDirectoryName: string): string {
  return fileOrDirectoryName.replace(/\.[^.]+$/, '');
}

function toKebabCase(value: string): string {
  const noExtension = stripExtension(value);
  return noExtension
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function componentLabel(filePath: string): string | null {
  const match = filePath.match(/^packages\/vkui\/src\/components\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) {
    return null;
  }
  const component = toKebabCase(match[1]);
  if (!component) {
    return null;
  }
  return `cmp:${component}`;
}

function hookLabel(filePath: string): string | null {
  const match = filePath.match(/^packages\/vkui\/src\/hooks\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) {
    return null;
  }
  const hookName = toKebabCase(match[1]);
  if (!hookName || hookName === 'index') {
    return null;
  }
  return `hook:${hookName}`;
}

function hasDocumentationChanges(filePath: string): boolean {
  return filePath === 'website' || filePath.startsWith('website/');
}

function hasDependenciesChanges(filePath: string): boolean {
  return dependencyFileNames.has(path.basename(filePath));
}

function hasGithubActionsChanges(filePath: string): boolean {
  return filePath === '.github' || filePath.startsWith('.github/');
}

function toSubpackageLabel(packageName: string): string {
  return `subpackage:@vkontakte/${packageName}`;
}

function specialSubpackageLabel(filePath: string): string | null {
  const directoryMatch = filePath.match(/^packages\/([^/]+)(?:\/|$)/);
  if (!directoryMatch?.[1]) {
    return null;
  }
  const packageName = directoryMatch[1];

  if (packageName === 'vkui') {
    return null;
  }
  if (packageName === 'codemods') {
    return toSubpackageLabel('vkui-codemods');
  }

  return toSubpackageLabel(packageName);
}

export function getLabelsByChangedFiles(rawPaths: string[]): string[] {
  const labels = new Set<string>();

  for (const rawPath of rawPaths) {
    const filePath = normalizePath(rawPath);
    if (!filePath) {
      continue;
    }

    const component = componentLabel(filePath);
    if (component) {
      labels.add(component);
    }

    const hook = hookLabel(filePath);
    if (hook) {
      labels.add(hook);
    }

    if (hasDocumentationChanges(filePath)) {
      labels.add('docs');
    }

    if (hasDependenciesChanges(filePath)) {
      labels.add('dependencies');
    }

    if (hasGithubActionsChanges(filePath)) {
      labels.add('github_actions');
    }

    const subpackage = specialSubpackageLabel(filePath);
    if (subpackage) {
      labels.add(subpackage);
    }
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b));
}

export function getLabelColor(label: string): string {
  if (label.startsWith('cmp:')) {
    return 'eeeeee';
  }
  if (label.startsWith('hook:')) {
    return 'bfdadc';
  }
  if (label.startsWith('subpackage:')) {
    return '1D76DB';
  }

  return '000000';
}
