import * as github from '@actions/github';
import * as core from '@actions/core';

type Octokit = ReturnType<typeof github.getOctokit>;

export const checkVKCOMMember = async ({
  octokit,
  author,
}: {
  octokit: Octokit;
  author: string;
}) => {
  try {
    core.debug(`[checkVKCOMMember] author: ${author}`);
    // Проверяем, принадлежит ли автор к организации VKCOM
    const { data: orgs } = await octokit.rest.orgs.listForUser({
      username: author,
    });

    core.debug(
      `[checkVKCOMMember] organization: ${JSON.stringify(orgs.map(({ login }) => login))}`,
    );

    const isVKCOMMember = orgs.some((org) => org.login === 'VKCOM');

    return isVKCOMMember;
  } catch (e) {}
  return false;
};
