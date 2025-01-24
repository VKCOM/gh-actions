import * as core from '@actions/core';
import * as github from '@actions/github';

import { GithubRepository } from '../entities/repositories';

export class GitHub implements GithubRepository {
  private readonly octokit: ReturnType<typeof github.getOctokit>;

  public constructor() {
    const token = core.getInput('token', { required: true });
    this.octokit = github.getOctokit(token);
  }

  public async pullRequestPaths(): Promise<string[]> {
    if (github.context.payload.pull_request === undefined) {
      throw new Error('Not found information about Pull Request');
    }

    const response = await this.octokit.graphql<{
      repository: {
        pullRequest: {
          files: {
            nodes: Array<{
              path: string;
            }>;
          };
        };
      };
    }>(
      `
      query($owner:String!, $repo: String!, $pull_number: Int!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pull_number) {
            files(first:$first) {
              nodes {
                path
              }
            }
          }
        }
      }
      `,
      {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: github.context.payload.pull_request.number,
        first: 100,
      },
    );

    return response.repository.pullRequest.files.nodes.map((file) => file.path);
  }

  public async warningFile(path: string, message: string): Promise<void> {
    core.warning(message, {
      title: 'Проверка опечаток',
      file: path,
    });
  }
}
