import { describe, expect, it, jest } from '@jest/globals';
import * as github from '@actions/github';
import { updateReleaseNotes } from './updateReleaseNotes';

type Octokit = ReturnType<typeof github.getOctokit>;
type ArrayElement<ArrayType extends any[] | undefined> =
  ArrayType extends Array<infer ElementType> ? ElementType : never;

type PullRequestData = Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data'];

type IssueData = Awaited<ReturnType<Octokit['rest']['issues']['get']>>['data'];

type PartialPullRequestData = Partial<Omit<PullRequestData, 'head'>> & {
  head: {
    repo: {
      fork: boolean;
    };
  };
};

type PartialIssueData = Partial<IssueData>;

const setupData = () => {
  const getPullRequest = jest.fn();
  const getReleaseRequest = jest.fn();
  const createReleaseRequest = jest.fn();
  const updateReleaseRequest = jest.fn();
  const getIssueRequest = jest.fn();

  const pullRequestData: PartialPullRequestData = {
    body: '',
    labels: [],
    milestone: null,
    head: {
      repo: {
        fork: false,
      },
    },
  };

  const issueData: PartialIssueData = {
    number: 123,
    milestone: null,
  };

  let releaseData: Partial<
    Awaited<ReturnType<Octokit['rest']['repos']['getReleaseByTag']>>['data']
  > | null = null;

  let lastReleaseName = '';

  const octokit = {
    rest: {
      issues: {
        get: (async (options) => {
          getIssueRequest(options);
          return { data: issueData };
        }) as Octokit['rest']['issues']['get'],
      },
      pulls: {
        get: (async (options) => {
          getPullRequest(options);
          return { data: pullRequestData };
        }) as Octokit['rest']['pulls']['get'],
      },
      repos: {
        listReleases: (async (options) => {
          getReleaseRequest(options);
          return {
            data: [releaseData],
          };
        }) as Octokit['rest']['repos']['listReleases'],
        getLatestRelease: (async () => {
          return {
            data: {
              name: lastReleaseName,
            },
          };
        }) as Octokit['rest']['repos']['getLatestRelease'],
        createRelease: (async (options) => {
          createReleaseRequest(options);
          releaseData = {
            id: 123456,
            body: '',
            draft: true,
          };
          return { data: releaseData };
        }) as Octokit['rest']['repos']['createRelease'],
        updateRelease: ((options) => {
          updateReleaseRequest(options);
        }) as Octokit['rest']['repos']['updateRelease'],
      },
    },
  };

  return {
    getPullRequest,
    getReleaseRequest,
    createReleaseRequest,
    updateReleaseRequest,
    octokit: octokit as unknown as Octokit,
    set lastReleaseName(name: string) {
      lastReleaseName = name;
    },
    set issueData(
      data: Partial<Omit<IssueData, 'milestone'>> & {
        milestone?: Partial<IssueData['milestone']>;
      },
    ) {
      if (data.milestone) {
        issueData.milestone = data.milestone as IssueData['milestone'];
      }
    },
    set pullRequestData(
      data: Partial<Omit<typeof pullRequestData, 'user' | 'labels' | 'milestone'>> & {
        milestone?: Partial<(typeof pullRequestData)['milestone']>;
        user?: Partial<(typeof pullRequestData)['user']>;
        labels?: Array<Partial<ArrayElement<(typeof pullRequestData)['labels']>>>;
        fork?: boolean;
      },
    ) {
      if (data.milestone) {
        pullRequestData.milestone = data.milestone as (typeof pullRequestData)['milestone'];
      }
      if (data.labels) {
        pullRequestData.labels = data.labels as (typeof pullRequestData)['labels'];
      }
      if (data.body) {
        pullRequestData.body = data.body;
      }
      if (data.user) {
        pullRequestData.user = data.user as (typeof pullRequestData)['user'];
      }
      if (data.fork !== undefined) {
        pullRequestData.head.repo.fork = data.fork;
      }
    },
    set releaseData(data: Partial<typeof releaseData>) {
      if (!data) {
        releaseData = data;
        return;
      } else {
        releaseData = {};
      }
      if (data.draft !== undefined) {
        releaseData.draft = data.draft;
      }
      if (data.body) {
        releaseData.body = data.body;
      }
      if (data.id) {
        releaseData.id = data.id;
      }
      if (data.name) {
        releaseData.name = data.name;
      }
    },
  };
};

describe('run updateReleaseNotes', () => {
  it('add notes to existed sections', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
Картинка с новым компонентом
Какая-то доп информация
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
Немного подробнее об этом. Можно приложить картинку
- ChipsInput: Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'other',
      },
      fork: true,
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234, спасибо @other)\r
  Картинка с новым компонентом\r
  Какая-то доп информация\r
- Новый компонент с название COMPONENT3 (#1234, спасибо @other)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0/#/ChipsSelect):\r
  - Улучшение компонента ChipsSelect (#7023)\r
  - Улучшение компонента ChipsSelect 2 (#1234, спасибо @other)\r
    Немного подробнее об этом. Можно приложить картинку\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234, спасибо @other)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234, спасибо @other)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0/#/Flex): Исправление компонента Flex (#1234, спасибо @other)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 1\r
- Обновлена какая-то зависимость 2 (#1234, спасибо @other)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234, спасибо @other)\r
\r
`,
    });
  });

  it('add notes to not existed section', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
- [ChipsInput](https://vkcom.github.io/VKUI/6.3.0/#/ChipsInput): Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'eldar',
      },
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234)\r
- Новый компонент с название COMPONENT3 (#1234)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0/#/Flex): Исправление компонента Flex (#1234)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2 (#1234)\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 2 (#1234)\r
`,
    });
  });

  it('update release notes with pull request without release notes', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView
`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request
`,
      user: {
        login: 'eldar',
      },
      milestone: {
        title: 'v6.6.0',
      },
    };
    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView
\r
## Нужно описать\r
#1234`,
    });
  });

  it('check update next patch version release notes', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.5.2',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT
`,
    };

    mockedData.pullRequestData = {
      body: `
## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
- Новый компонент с название COMPONENT3
`,
      user: {
        login: 'eldar',
      },
      labels: [
        {
          name: 'patch',
        },
      ],
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });
  });

  it('check correct update release notes with additional info', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [PanelHeaderButton](https://vkcom.github.io/VKUI/6.7.0/#/PanelHeaderButton): добавлена поддержка компонента \`Badge\` в \`label\` (#7526)
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/14bb6d5e-2390-4766-8bdb-8e16d5166523">
  <img width="480" src="https://github.com/user-attachments/assets/404e2412-ed5d-4503-bf61-7c41d8784719"/>
  </picture>
- [Text](https://vkcom.github.io/VKUI/6.7.0/#/Text): добавлено использование compact токенов fontWeight/fontFamily в режиме compact (#7564)
- [Caption](https://vkcom.github.io/VKUI/6.7.0/#/Caption): добавлена поддержка compact режима (#7555)
`,
    };

    mockedData.pullRequestData = {
      body: `
- [x] e2e-тесты
- [x] Дизайн-ревью
- [x] Документация фичи
- [x] Release notes

## Описание

Добавить возможность прокидывать текст в \`ScreenSpinner\`

## Release notes

## Улучшения
- ScreenSpinner: добавлена возможность прокидывать \`caption\`
 
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/60251995-5276-4d3d-89ae-d4380d5039f4">
  <img width="480" src="https://github.com/user-attachments/assets/6db873ff-7d78-49cf-b930-9e47f5557a8e"/>
  </picture>
`,
      user: {
        login: 'eldar',
      },
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения\r
- [PanelHeaderButton](https://vkcom.github.io/VKUI/6.6.0/#/PanelHeaderButton): добавлена поддержка компонента \`Badge\` в \`label\` (#7526)\r
  <picture>\r
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/14bb6d5e-2390-4766-8bdb-8e16d5166523">\r
  <img width="480" src="https://github.com/user-attachments/assets/404e2412-ed5d-4503-bf61-7c41d8784719"/>\r
  </picture>\r
- [Text](https://vkcom.github.io/VKUI/6.6.0/#/Text): добавлено использование compact токенов fontWeight/fontFamily в режиме compact (#7564)\r
- [Caption](https://vkcom.github.io/VKUI/6.6.0/#/Caption): добавлена поддержка compact режима (#7555)\r
- [ScreenSpinner](https://vkcom.github.io/VKUI/6.6.0/#/ScreenSpinner): добавлена возможность прокидывать \`caption\` (#1234)\r
  <picture>\r
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/60251995-5276-4d3d-89ae-d4380d5039f4">\r
  <img width="480" src="https://github.com/user-attachments/assets/6db873ff-7d78-49cf-b930-9e47f5557a8e"/>\r
  </picture>\r
\r
`,
    });
  });

  it('check calculate correct release by milestone title', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0-beta.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
Картинка с новым компонентом
Какая-то доп информация
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
Немного подробнее об этом. Можно приложить картинку
- ChipsInput: Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'other',
      },
      fork: true,
      milestone: {
        title: 'v6.6.0-beta.0',
      },
    };

    mockedData.lastReleaseName = 'v6.4.0';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234, спасибо @other)\r
  Картинка с новым компонентом\r
  Какая-то доп информация\r
- Новый компонент с название COMPONENT3 (#1234, спасибо @other)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0-beta.0/#/ChipsSelect):\r
  - Улучшение компонента ChipsSelect (#7023)\r
  - Улучшение компонента ChipsSelect 2 (#1234, спасибо @other)\r
    Немного подробнее об этом. Можно приложить картинку\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0-beta.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234, спасибо @other)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0-beta.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234, спасибо @other)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0-beta.0/#/Flex): Исправление компонента Flex (#1234, спасибо @other)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 1\r
- Обновлена какая-то зависимость 2 (#1234, спасибо @other)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0-beta.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234, спасибо @other)\r
\r
`,
    });
  });

  it('should correct add changes with code diff', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.5.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## BREAKING CHANGE

- Header: изменен формат \`size\`  с \`'regular' | 'large'\` на \`'m' | 'l'\`
  \`\`\`diff
  - <Header mode="primary" size="large">
  + <Header mode="primary" size="l">
    Большой заголовок
  </Header>
  \`\`\`
- Проверка более сложного примера кода
  \`\`\`diff
  - <Header mode="primary" size="large">
  + <Header mode="primary" size="l">
    <div>
      <div>
        Большой заголовок
      </div>
    </div>
  </Header>
  \`\`\`
- Spinner: изменен формат \`size\`  с \`'small' | 'regular' | 'medium' | 'large'\` на \`'s' | 'm' | 'l' | 'xl'\`
  \`\`\`diff
  - <Spinner size="large" />
  + <Spinner size="xl" />
  - <Spinner size="medium" />
  + <Spinner size="l" />
  - <Spinner size="regular" />
  + <Spinner size="m" />
  - <Spinner size="small" />
  + <Spinner size="s" />
  \`\`\`
`,
      user: {
        login: 'eldar',
      },
      fork: false,
    };

    mockedData.lastReleaseName = 'v6.4.0';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView\r
## BREAKING CHANGE\r
- [Header](https://vkcom.github.io/VKUI/6.5.0/#/Header): изменен формат \`size\`  с \`'regular' | 'large'\` на \`'m' | 'l'\` (#1234)\r
  \`\`\`diff\r
  - <Header mode="primary" size="large">\r
  + <Header mode="primary" size="l">\r
    Большой заголовок\r
  </Header>\r
  \`\`\`\r
- Проверка более сложного примера кода (#1234)\r
  \`\`\`diff\r
  - <Header mode="primary" size="large">\r
  + <Header mode="primary" size="l">\r
    <div>\r
      <div>\r
        Большой заголовок\r
      </div>\r
    </div>\r
  </Header>\r
  \`\`\`\r
- [Spinner](https://vkcom.github.io/VKUI/6.5.0/#/Spinner): изменен формат \`size\`  с \`'small' | 'regular' | 'medium' | 'large'\` на \`'s' | 'm' | 'l' | 'xl'\` (#1234)\r
  \`\`\`diff\r
  - <Spinner size="large" />\r
  + <Spinner size="xl" />\r
  - <Spinner size="medium" />\r
  + <Spinner size="l" />\r
  - <Spinner size="regular" />\r
  + <Spinner size="m" />\r
  - <Spinner size="small" />\r
  + <Spinner size="s" />\r
  \`\`\`\r
`,
    });
  });

  it('should select release by linked issue milestone', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
- close #123      

## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
Картинка с новым компонентом
Какая-то доп информация
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
Немного подробнее об этом. Можно приложить картинку
- ChipsInput: Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'eldar',
      },
      fork: false,
    };

    mockedData.issueData = {
      milestone: {
        title: 'v6.6.0',
      },
    };

    mockedData.lastReleaseName = 'v6.4.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234)\r
  Картинка с новым компонентом\r
  Какая-то доп информация\r
- Новый компонент с название COMPONENT3 (#1234)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0/#/ChipsSelect):\r
  - Улучшение компонента ChipsSelect (#7023)\r
  - Улучшение компонента ChipsSelect 2 (#1234)\r
    Немного подробнее об этом. Можно приложить картинку\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0/#/Flex): Исправление компонента Flex (#1234)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 1\r
- Обновлена какая-то зависимость 2 (#1234)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234)\r
\r
`,
    });
  });
});
