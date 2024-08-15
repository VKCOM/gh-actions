import * as core from '@actions/core';
import * as github from '@actions/github';
import { getCurrentVersion, getNextMinorVersion } from './getVersion';
import { addMilestoneToPR, createMilestone, getMilestone } from './milestone';

async function run() {
  try {
    const token = core.getInput('token', { required: true });
    const octokit = github.getOctokit(token);

    const { pull_request } = github.context.payload;

    if (pull_request) {
      const currentVersion = getCurrentVersion();
      const nextMinorVersion = getNextMinorVersion(currentVersion);

      let milestone = await getMilestone(octokit, nextMinorVersion);
      if (!milestone) {
        milestone = await createMilestone(octokit, nextMinorVersion);
      }

      await addMilestoneToPR(octokit, pull_request.number, milestone.number);
    }
  } catch (error) {}
}

void run();
