import * as assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type * as github from '@actions/github';
import { updateReleaseNotes } from './updateReleaseNotes.ts';

type Octokit = ReturnType<typeof github.getOctokit>;
type Milestone = { title: string } | null;
type Release = {
  id: number;
  name: string;
  tag_name: string;
  draft: boolean;
  body: string;
};

const setup = () => {
  const state = {
    pullRequest: {
      body: '## Release notes\n## Улучшения\n- Добавлены новые токены.',
      milestone: null as Milestone,
      labels: [] as Array<{ name: string }>,
      user: { login: 'contributor' },
      head: { repo: { fork: false } },
    },
    issue: { milestone: null as Milestone },
    latestRelease: { name: 'v4.93.2' },
    releases: [{ id: 1, name: 'v4.94.0', tag_name: 'v4.94.0', draft: true, body: '' }] as Release[],
  };

  const getPullRequest = mock.fn(async () => ({ data: state.pullRequest }));
  const getIssue = mock.fn(async () => ({ data: state.issue }));
  const getLatestRelease = mock.fn(async () => ({ data: state.latestRelease }));
  const listReleases = mock.fn(async () => ({ data: state.releases }));
  const createRelease = mock.fn(
    async (options: { name: string; tag_name: string; body: string; draft: boolean }) => ({
      data: { id: 2, ...options },
    }),
  );
  const updateRelease = mock.fn(
    async (options: { owner: string; repo: string; release_id: number; body: string }) => ({
      data: options,
    }),
  );

  const octokit = {
    rest: {
      pulls: { get: getPullRequest },
      issues: { get: getIssue },
      repos: { getLatestRelease, listReleases, createRelease, updateRelease },
    },
  } as unknown as Octokit;

  return {
    state,
    getPullRequest,
    getIssue,
    getLatestRelease,
    listReleases,
    createRelease,
    updateRelease,
    run: () => updateReleaseNotes({ octokit, owner: 'VKCOM', repo: 'vkui-tokens', prNumber: 123 }),
  };
};

describe('vkui-tokens release notes', () => {
  it('updates the next minor draft without labels', async () => {
    const data = setup();
    await data.run();

    assert.equal(data.getLatestRelease.mock.callCount(), 1);
    assert.equal(data.createRelease.mock.callCount(), 0);
    assert.deepEqual(data.updateRelease.mock.calls[0].arguments[0], {
      owner: 'VKCOM',
      repo: 'vkui-tokens',
      release_id: 1,
      body: '\r\n## Улучшения\r\n- Добавлены новые токены (#123)\r\n',
    });
  });

  it('creates a missing draft with a name compatible with publish-release-notes', async () => {
    const data = setup();
    data.state.releases = [];
    await data.run();

    assert.deepEqual(data.createRelease.mock.calls[0].arguments[0], {
      owner: 'VKCOM',
      repo: 'vkui-tokens',
      tag_name: 'v4.94.0',
      name: 'v4.94.0',
      body: '',
      draft: true,
      prerelease: false,
    });
    assert.equal(data.updateRelease.mock.calls[0].arguments[0].release_id, 2);
  });

  it('uses a patch milestone without querying the latest release', async () => {
    const data = setup();
    data.state.pullRequest.milestone = { title: 'v4.93.3' };
    data.state.releases[0].name = 'v4.93.3';
    await data.run();

    assert.equal(data.getLatestRelease.mock.callCount(), 0);
    assert.equal(data.createRelease.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.calls[0].arguments[0].release_id, 1);
  });

  it('uses the linked issue milestone', async () => {
    const data = setup();
    data.state.pullRequest.body = `Closes #42\n${data.state.pullRequest.body}`;
    data.state.issue.milestone = { title: 'v4.95.0' };
    data.state.releases = [];
    await data.run();

    assert.equal(data.getIssue.mock.callCount(), 1);
    assert.equal(data.getLatestRelease.mock.callCount(), 0);
    assert.equal(data.createRelease.mock.calls[0].arguments[0].name, 'v4.95.0');
  });

  it('prefers the PR milestone over the linked issue milestone', async () => {
    const data = setup();
    data.state.pullRequest.body = `Fixes #42\n${data.state.pullRequest.body}`;
    data.state.pullRequest.milestone = { title: 'v4.94.0' };
    data.state.issue.milestone = { title: 'v4.95.0' };
    await data.run();

    assert.equal(data.getIssue.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.calls[0].arguments[0].release_id, 1);
  });

  it('preserves existing notes and groups named changes without VKUI links', async () => {
    const data = setup();
    data.state.releases[0].body = '## Улучшения\n- Button: Старое изменение (#10)\n';
    data.state.pullRequest.body = `## Release notes
## Улучшения
- Button: добавлены токены.
  Подробности изменения
  \`\`\`css
  color: var(--vkui--color_text_primary);
  \`\`\`
## Исправления
- Исправлена генерация CSS.
<!-- Конец release notes -->`;
    await data.run();

    assert.equal(
      data.updateRelease.mock.calls[0].arguments[0].body,
      `## Улучшения\r
- Button:\r
  - Старое изменение (#10)\r
  - Добавлены токены (#123)\r
    Подробности изменения\r
    \`\`\`css\r
    color: var(--vkui--color_text_primary);\r
    \`\`\`\r
\r
\r
## Исправления\r
- Исправлена генерация CSS (#123)\r
`,
    );
  });

  it('thanks contributors from forks', async () => {
    const data = setup();
    data.state.pullRequest.head.repo.fork = true;
    await data.run();

    assert.match(data.updateRelease.mock.calls[0].arguments[0].body, /#123, спасибо @contributor/);
  });

  it('adds an undescribed PR to its milestone draft', async () => {
    const data = setup();
    data.state.pullRequest.body = 'Описание без release notes';
    data.state.pullRequest.milestone = { title: 'v4.94.0' };
    await data.run();

    assert.equal(
      data.updateRelease.mock.calls[0].arguments[0].body,
      '\r\n## Нужно описать\r\n#123',
    );
  });

  it('skips a PR without notes and a milestone', async () => {
    const data = setup();
    data.state.pullRequest.body = '';
    await data.run();

    assert.equal(data.getLatestRelease.mock.callCount(), 0);
    assert.equal(data.listReleases.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.callCount(), 0);
  });

  it('skips explicitly empty notes even with a milestone', async () => {
    const data = setup();
    data.state.pullRequest.body = '## Release notes\n-';
    data.state.pullRequest.milestone = { title: 'v4.94.0' };
    await data.run();

    assert.equal(data.listReleases.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.callCount(), 0);
  });

  it('ignores labels when selecting the version', async () => {
    const data = setup();
    data.state.pullRequest.labels = [{ name: 'bug' }];
    await data.run();

    assert.equal(data.createRelease.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.calls[0].arguments[0].release_id, 1);
  });

  it('updates the major draft and its latest RC draft', async () => {
    const data = setup();
    data.state.pullRequest.milestone = { title: 'v5.0.0' };
    data.state.releases = [
      { id: 3, name: 'v5.0.0', tag_name: 'v5.0.0', draft: true, body: '' },
      { id: 4, name: 'v5.0.0-rc.2', tag_name: 'v5.0.0-rc.2', draft: true, body: '' },
      { id: 5, name: 'v5.0.0-rc.1', tag_name: 'v5.0.0-rc.1', draft: true, body: '' },
    ];
    await data.run();

    assert.deepEqual(
      data.updateRelease.mock.calls.map((call) => call.arguments[0].release_id),
      [3, 4],
    );
  });

  it('skips an unavailable PR', async () => {
    const data = setup();
    data.getPullRequest.mock.mockImplementation(async () => {
      throw new Error('Not found');
    });
    await data.run();

    assert.equal(data.listReleases.mock.callCount(), 0);
  });

  it('skips an unavailable latest release', async () => {
    const data = setup();
    data.getLatestRelease.mock.mockImplementation(async () => {
      throw new Error('Not found');
    });
    await data.run();

    assert.equal(data.listReleases.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.callCount(), 0);
  });

  it('skips a latest release without a version', async () => {
    const data = setup();
    data.state.latestRelease.name = 'Invalid version';
    await data.run();

    assert.equal(data.listReleases.mock.callCount(), 0);
    assert.equal(data.updateRelease.mock.callCount(), 0);
  });

  it('does not update a published release', async () => {
    const data = setup();
    data.state.releases[0].draft = false;
    data.createRelease.mock.mockImplementation(async () => {
      throw new Error('Tag already exists');
    });
    await data.run();

    assert.equal(data.updateRelease.mock.callCount(), 0);
  });
});
