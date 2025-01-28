import * as core from '@actions/core';
import { NSpellSpellChecker } from './repositories/spell';
import { GitHub } from './repositories/github';
import { ActionService } from './service/action';
import { Repositories } from './entities/repositories';

function prodRepositories(): Repositories {
  return {
    spellCheckerRepository: new NSpellSpellChecker(),
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
