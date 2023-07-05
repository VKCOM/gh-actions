import * as core from '@actions/core';
import * as github from '@actions/github';

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const gh = github.getOctokit(token);

    const { data: milestones } = await gh.rest.issues.listMilestones({
      ...github.context.repo,
      state: 'open',
    });

    core.debug(`Opened milestones: [${milestones.map((m) => m.title)}]`);

    const actualMilestone = milestones.find((milestone) => {
      if (milestone.due_on) {
        const dueDate = new Date(milestone.due_on);
        const today = new Date();
        return (
          dueDate.getDate() === today.getDate() &&
          dueDate.getMonth() === today.getMonth() &&
          dueDate.getFullYear() === today.getFullYear()
        );
      }
      return false;
    });

    core.debug(`Founded milestone for today: ${actualMilestone}`);

    if (actualMilestone) {
      console.info(`Founded milestone: ${actualMilestone.title}`);
      core.setOutput('milestone_name', actualMilestone.title);
    } else {
      core.info('There is no milestone for today');
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

void run();
