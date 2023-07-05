import * as core from '@actions/core';
import { WorkflowHandler } from './workflowHandler';

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const releaseTag = core.getInput('releaseTag', { required: true });

    const workflow = new WorkflowHandler(token, releaseTag);

    await workflow.processReleaseNotes();
    await workflow.processMilestone();

    if (workflow.isProcessWithError()) {
      throw new Error('There were errors during the process. Check the logs for more information');
    }
    core.info('Workflow completed');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
