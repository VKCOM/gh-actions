import * as core from '@actions/core';
import * as github from '@actions/github';
import { getCurrentVersion, getNextMinorVersion } from './getVersion';
import { addMilestoneToPR, createMilestone, getMilestone } from './milestone';

async function run() {
  try {
    const token = core.getInput('token', { required: true });
    const prNumber = Number(core.getInput('pull_request_number', { required: true }));
    const octokit = github.getOctokit(token);

    if (prNumber) {
      const currentVersion = getCurrentVersion();
      const nextMinorVersion = getNextMinorVersion(currentVersion);

      let milestone = await getMilestone(octokit, nextMinorVersion);
      if (!milestone) {
        milestone = await createMilestone(octokit, nextMinorVersion);
      }

      await addMilestoneToPR(octokit, prNumber, milestone.number);
    }
  } catch (_error) {}
}

void run();
