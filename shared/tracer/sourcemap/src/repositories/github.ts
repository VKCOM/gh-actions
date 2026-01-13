import * as core from '@actions/core';

import type { GitHubRepository } from '../entities/repositories';

export class GitHub implements GitHubRepository {
  public async getInput() {
    return {
      path: core.getInput('path', { required: true }),
      pluginToken: core.getInput('pluginToken', { required: true }),
      versionName: core.getInput('versionName', { required: true }),
      versionCode: Number(core.getInput('versionCode', { required: true })),
      buildUuid: core.getInput('buildUuid') || undefined,
      apiHost: core.getInput('apiHost') || undefined,
    };
  }
}
