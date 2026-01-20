import * as core from '@actions/core';
import * as github from '@actions/github';
import { updateReleaseNotes } from './updateReleaseNotes.ts';

async function run() {
  const token = core.getInput('token', { required: true });
  const prNumber = Number(core.getInput('pull_request_number', { required: true }));
  const currentIconsVersion = core.getInput('current_icons_version', {
    required: true,
  });
  const octokit = github.getOctokit(token);

  const { owner, repo } = github.context.repo;

  await updateReleaseNotes({
    octokit,
    prNumber,
    owner,
    repo,
    currentIconsVersion,
  });
}

void run();
