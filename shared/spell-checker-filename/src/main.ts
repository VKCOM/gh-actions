import * as core from '@actions/core';
import type { Repositories } from './entities/repositories.ts';
import { GitHub } from './repositories/github.ts';
import { NSpellSpellChecker } from './repositories/spell.ts';
import { ActionService } from './service/action.ts';

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
