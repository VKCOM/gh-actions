import * as core from '@actions/core';
import * as github from '@actions/github';

type OctokitProp = ReturnType<typeof github.getOctokit>;

async function wait(milliseconds: number): Promise<string> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getIssueCommentBody(releaseTag: string) {
  const {
    repo: { repo, owner },
  } = github.context;

  const url = `https://github.com/${owner}/${repo}/releases/tag/${releaseTag}`;
  return `✅ <a href="${url}" target="_blank">${releaseTag}</a> 🎉`;
}

const COMMENT_WAIT_INTERVAL_MS = 1500;

export class WorkflowHandler {
  private readonly gh: OctokitProp;
  private readonly releaseTag: string;
  private error = false;

  public constructor(token: string, releaseTag: string) {
    this.gh = github.getOctokit(token);
    this.releaseTag = releaseTag.startsWith('v') ? releaseTag : `v${releaseTag}`;
  }

  public async processMilestone() {
    try {
      const milestoneNumber = await this.findMilestoneNumberByReleaseTag();
      const issueNumbers = await this.getIssueNumbersByMilestone(milestoneNumber);

      await this.commentOnIssues(issueNumbers);
      await this.closeMilestone(milestoneNumber);
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      }
      this.error = true;
    }
  }

  public async processReleaseNotes() {
    try {
      const releaseNotes = await this.findReleaseNotes();

      if (!releaseNotes) {
        throw new Error(`There are no release notes for ${this.releaseTag}`);
      }

      await this.publishReleaseNotes(releaseNotes.id);
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      }
      this.error = true;
    }
  }

  public isProcessWithError() {
    return this.error;
  }

  private async findReleaseNotes() {
    const { data: releases } = await this.gh.rest.repos.listReleases({
      ...github.context.repo,
    });

    return releases.find(({ draft, name }) => draft && name === this.releaseTag);
  }

  private async publishReleaseNotes(release_id: number) {
    await this.gh.rest.repos.updateRelease({
      ...github.context.repo,
      tag_name: this.releaseTag,
      release_id,
      draft: false,
      prerelease: this.releaseTag.includes('-'),
    });
  }

  private async findMilestoneNumberByReleaseTag() {
    const { data: milestones } = await this.gh.rest.issues.listMilestones({
      ...github.context.repo,
      state: 'open',
    });

    const milestone = milestones.find(({ title }) => title === this.releaseTag);

    if (milestone) {
      return milestone.number;
    }

    throw new Error(`There is no milestone for tag ${this.releaseTag}`);
  }

  private async getIssueNumbersByMilestone(milestoneNumber: number) {
    const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, {
      ...github.context.repo,
      milestone: `${milestoneNumber}`,
      state: 'all',
    });

    return issues.map((issue) => issue.number);
  }

  private async commentOnIssues(issueNumbers: number[]) {
    core.debug(`Processing the following linked issues: [${issueNumbers}]`);

    const body = getIssueCommentBody(this.releaseTag);

    for (let issue_number of issueNumbers) {
      await this.gh.rest.issues.createComment({
        ...github.context.repo,
        issue_number,
        body,
      });

      // https://docs.github.com/en/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits
      await wait(COMMENT_WAIT_INTERVAL_MS);
    }
  }

  private async closeMilestone(milestone_number: number) {
    core.debug(`Closing ${milestone_number} milestone`);
    await this.gh.rest.issues.updateMilestone({
      ...github.context.repo,
      milestone_number,
      state: 'closed',
    });
  }
}
