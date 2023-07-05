import * as core from '@actions/core';
import * as github from '@actions/github';
import { clean, SemVer } from 'semver';

function resolveWorkflowId() {
  let workflowIdStr = core.getInput('workflowId', { required: true });

  return /.+\.ya?ml$/.test(workflowIdStr) ? workflowIdStr : Number(workflowIdStr);
}

function getStableBranchName(semVer: SemVer) {
  return `${semVer.major}.${semVer.minor}-stable`;
}

const ZERO_PATCH = 0;

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const releaseTag = core.getInput('releaseTag', { required: true });
    const workflow_id = resolveWorkflowId();
    const defaultBranchName = core.getInput('defaultBranchName');
    const gh = github.getOctokit(token);

    const semVer = new SemVer(releaseTag);
    const ref = semVer.patch !== ZERO_PATCH ? getStableBranchName(semVer) : defaultBranchName;

    core.debug(`Dispatching workflow with the following params:
      workflowId: ${workflow_id}
      ref: ${ref}
      releaseTag: ${releaseTag}`);

    await gh.rest.actions.createWorkflowDispatch({
      ...github.context.repo,
      workflow_id,
      ref,
      inputs: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        custom_version: clean(releaseTag)!,
      },
    });

    core.info('Workflow successfully dispatched');
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

void run();
