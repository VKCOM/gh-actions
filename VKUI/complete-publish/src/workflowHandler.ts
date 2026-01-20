import * as core from '@actions/core';
import * as github from '@actions/github';
import { retry } from '@octokit/plugin-retry';

type OctokitProp = ReturnType<typeof github.getOctokit>;

async function wait(milliseconds: number): Promise<string> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getIssueCommentBody(releaseTag: string) {
  const {
    repo: { repo, owner },
  } = github.context;

  const url = `https://github.com/${owner}/${repo}/releases/tag/${releaseTag}`;
  return `<!-- disable_global_notification -->✅ <a href="${url}" target="_blank">${releaseTag}</a> 🎉`;
}

const COMMENT_WAIT_INTERVAL_MS = 1500;
// Исключаем задачи, которые были закрыты со статусом "not_planned (won't fix)"
const IGNORED_STATE = 'not_planned';

export class WorkflowHandler {
  private readonly gh: OctokitProp;
  private readonly releaseTag: string;
  private error = false;

  public constructor(token: string, releaseTagProp: string) {
    this.gh = github.getOctokit(token, { request: { retries: 3 } }, retry);
    const releaseTag = releaseTagProp.trim();
    this.releaseTag = releaseTag.startsWith('v') ? releaseTag : `v${releaseTag}`;
  }

  public async processMilestone() {
    try {
      const milestone = await this.findMilestoneByReleaseTag();

      if (!milestone) {
        throw new Error(`There is no milestone for tag ${this.releaseTag}`);
      } else if (milestone.closed_at === null) {
        await this.closeMilestone(milestone.number);
      } else {
        core.debug(`[processMilestone]: milestone ${milestone.number} already closed`);
      }

      const issueNumbers = await this.getIssueNumbersByMilestone(milestone.number);
      await this.commentOnIssues(issueNumbers);
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      }
      this.error = true;
    }
  }

  public async processIssuesByTagLabel() {
    try {
      const issueNumbers = await this.getIssueNumbersByTagLabel();

      await this.commentOnIssues(issueNumbers);
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      }
      this.error = true;
    }
  }

  public async processReleaseNotes(latest: boolean) {
    try {
      const releaseNotes = await this.findReleaseNotesByReleaseTag();

      if (!releaseNotes) {
        throw new Error(`There are no release notes for ${this.releaseTag}`);
      }

      if (releaseNotes.draft) {
        await this.publishReleaseNotes(releaseNotes.id, latest);
      }

      core.debug(`[processReleaseNotes]: ${releaseNotes.name} release notes already published`);
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

  private async findReleaseNotesByReleaseTag() {
    const { data: releases } = await this.gh.rest.repos.listReleases(github.context.repo);
    return releases.find(({ name }) => name === this.releaseTag);
  }

  private async findMilestoneByReleaseTag() {
    const { data: milestones } = await this.gh.rest.issues.listMilestones({
      ...github.context.repo,
      state: 'all',
      sort: 'completeness',
      direction: 'desc',
    });
    return milestones.find(({ title }) => title === this.releaseTag);
  }

  private async getIssueNumbersByMilestone(milestoneNumber: number) {
    const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, {
      ...github.context.repo,
      milestone: `${milestoneNumber}`,
      state: 'all',
    });

    return issues.reduce<number[]>((issueNumbers, issue) => {
      if (issue.state_reason !== IGNORED_STATE && !issue.locked) {
        issueNumbers.push(issue.number);
      }
      return issueNumbers;
    }, []);
  }

  private async getIssueNumbersByTagLabel() {
    const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, {
      ...github.context.repo,
      state: 'all',
      labels: this.releaseTag,
    });

    return issues.reduce<number[]>((issueNumbers, issue) => {
      if (issue.state_reason !== IGNORED_STATE && !issue.locked) {
        issueNumbers.push(issue.number);
      }
      return issueNumbers;
    }, []);
  }

  private async publishReleaseNotes(release_id: number, latest: boolean) {
    await this.gh.rest.repos.updateRelease({
      ...github.context.repo,
      tag_name: this.releaseTag,
      release_id,
      draft: false,
      prerelease: this.releaseTag.includes('-'),
      make_latest: latest ? 'true' : 'false',
    });
  }

  private async commentOnIssues(issueNumbers: number[]) {
    core.debug(`Processing the following linked issues: [${issueNumbers}]`);

    const issueCommentBody = getIssueCommentBody(this.releaseTag);

    for (const issue_number of issueNumbers) {
      const { data: listComments } = await this.gh.rest.issues.listComments({
        ...github.context.repo,
        issue_number,
      });

      if (listComments.some(({ body }) => (body ? body.includes(issueCommentBody) : false))) {
        core.debug(`[commentOnIssues] comment for #${issue_number} already exist`);
        continue;
      }

      await this.gh.rest.issues.createComment({
        ...github.context.repo,
        issue_number,
        body: issueCommentBody,
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
