import { PullRequestType } from '../types';

export const IMPROVEMENT_HEADER = 'Улучшения';
export const FIX_HEADER = 'Исправления';
export const DOCUMENTATION_HEADER = 'Документация';
export const DEPENDENCY_HEADER = 'Зависимости';
export const NEW_COMPONENT_HEADER = 'Новые компоненты';
export const NEED_TO_DESCRIBE_HEADER = 'Нужно описать';

export const getSectionTypeByHeader = (header: string): PullRequestType | null => {
  switch (header) {
    case IMPROVEMENT_HEADER:
      return 'improvement';
    case FIX_HEADER:
      return 'fix';
    case DOCUMENTATION_HEADER:
      return 'documentation';
    case DEPENDENCY_HEADER:
      return 'dependency';
    case NEW_COMPONENT_HEADER:
      return 'new-component';
  }
  return null;
};

export const getHeaderBySectionType = (type: PullRequestType): string | null => {
  switch (type) {
    case 'improvement':
      return IMPROVEMENT_HEADER;
    case 'fix':
      return FIX_HEADER;
    case 'documentation':
      return DOCUMENTATION_HEADER;
    case 'dependency':
      return DEPENDENCY_HEADER;
    case 'new-component':
      return NEW_COMPONENT_HEADER;
  }
  return null;
};
