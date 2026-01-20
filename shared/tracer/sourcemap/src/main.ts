import * as core from '@actions/core';
import type { Repositories } from './entities/repositories';
import { GitHub } from './repositories/github';
import { TracerSourceMap } from './repositories/tracer';
import { ActionService } from './service/action';

function prodRepositories(): Repositories {
  return {
    tracerSourceMapRepository: new TracerSourceMap(),
    githubRepository: new GitHub(),
  };
}

async function main(): Promise<void> {
  try {
    const repositories: Repositories = prodRepositories();

    const action = new ActionService(repositories);

    await action.run();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void main();
