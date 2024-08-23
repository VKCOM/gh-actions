import * as github from '@actions/github';

type Octokit = ReturnType<typeof github.getOctokit>;

export const checkVKCOMMember = async ({
  octokit,
  author,
}: {
  octokit: Octokit;
  author: string;
}) => {
  // Проверяем, принадлежит ли автор к организации VKCOM
  const { data: orgs } = await octokit.rest.orgs.listForUser({
    username: author,
  });

  const isVKCOMMember = orgs.some((org) => org.login === 'VKCOM');

  return isVKCOMMember;
};
