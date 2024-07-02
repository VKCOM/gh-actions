"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var core2 = __toESM(require("@actions/core"));

// src/workflowHandler.ts
var import_plugin_retry = require("@octokit/plugin-retry");
var core = __toESM(require("@actions/core"));
var github = __toESM(require("@actions/github"));
async function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function getIssueCommentBody(releaseTag) {
  const {
    repo: { repo, owner }
  } = github.context;
  const url = `https://github.com/${owner}/${repo}/releases/tag/${releaseTag}`;
  return `<!-- disable_global_notification -->\u2705 <a href="${url}" target="_blank">${releaseTag}</a> \u{1F389}`;
}
var COMMENT_WAIT_INTERVAL_MS = 1500;
var IGNORED_STATE = "not_planned";
var WorkflowHandler = class {
  constructor(token, releaseTagProp) {
    this.error = false;
    this.gh = github.getOctokit(token, { request: { retries: 3 } }, import_plugin_retry.retry);
    const releaseTag = releaseTagProp.trim();
    this.releaseTag = releaseTag.startsWith("v") ? releaseTag : `v${releaseTag}`;
  }
  async processMilestone() {
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
    } catch (error2) {
      if (error2 instanceof Error) {
        core.error(error2.message);
      }
      this.error = true;
    }
  }
  async processIssuesByTagLabel() {
    try {
      const issueNumbers = await this.getIssueNumbersByTagLabel();
      await this.commentOnIssues(issueNumbers);
    } catch (error2) {
      if (error2 instanceof Error) {
        core.error(error2.message);
      }
      this.error = true;
    }
  }
  async processReleaseNotes(latest) {
    try {
      const releaseNotes = await this.findReleaseNotesByReleaseTag();
      if (!releaseNotes) {
        throw new Error(`There are no release notes for ${this.releaseTag}`);
      }
      if (releaseNotes.draft) {
        await this.publishReleaseNotes(releaseNotes.id, latest);
      }
      core.debug(`[processReleaseNotes]: ${releaseNotes.name} release notes already published`);
    } catch (error2) {
      if (error2 instanceof Error) {
        core.error(error2.message);
      }
      this.error = true;
    }
  }
  isProcessWithError() {
    return this.error;
  }
  async findReleaseNotesByReleaseTag() {
    const { data: releases } = await this.gh.rest.repos.listReleases(github.context.repo);
    return releases.find(({ name }) => name === this.releaseTag);
  }
  async findMilestoneByReleaseTag() {
    const { data: milestones } = await this.gh.rest.issues.listMilestones({
      ...github.context.repo,
      state: "all",
      sort: "completeness",
      direction: "desc"
    });
    return milestones.find(({ title }) => title === this.releaseTag);
  }
  async getIssueNumbersByMilestone(milestoneNumber) {
    const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, {
      ...github.context.repo,
      milestone: `${milestoneNumber}`,
      state: "all"
    });
    return issues.reduce((issueNumbers, issue) => {
      if (issue.state_reason !== IGNORED_STATE && !issue.locked) {
        issueNumbers.push(issue.number);
      }
      return issueNumbers;
    }, []);
  }
  async getIssueNumbersByTagLabel() {
    const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, {
      ...github.context.repo,
      state: "all",
      labels: this.releaseTag
    });
    return issues.reduce((issueNumbers, issue) => {
      if (issue.state_reason !== IGNORED_STATE && !issue.locked) {
        issueNumbers.push(issue.number);
      }
      return issueNumbers;
    }, []);
  }
  async publishReleaseNotes(release_id, latest) {
    await this.gh.rest.repos.updateRelease({
      ...github.context.repo,
      tag_name: this.releaseTag,
      release_id,
      draft: false,
      prerelease: this.releaseTag.includes("-"),
      make_latest: latest ? "true" : "false"
    });
  }
  async commentOnIssues(issueNumbers) {
    core.debug(`Processing the following linked issues: [${issueNumbers}]`);
    const issueCommentBody = getIssueCommentBody(this.releaseTag);
    for (let issue_number of issueNumbers) {
      const { data: listComments } = await this.gh.rest.issues.listComments({
        ...github.context.repo,
        issue_number
      });
      if (listComments.some(({ body }) => body ? body.includes(issueCommentBody) : false)) {
        core.debug(`[commentOnIssues] comment for #${issue_number} already exist`);
        continue;
      }
      await this.gh.rest.issues.createComment({
        ...github.context.repo,
        issue_number,
        body: issueCommentBody
      });
      await wait(COMMENT_WAIT_INTERVAL_MS);
    }
  }
  async closeMilestone(milestone_number) {
    core.debug(`Closing ${milestone_number} milestone`);
    await this.gh.rest.issues.updateMilestone({
      ...github.context.repo,
      milestone_number,
      state: "closed"
    });
  }
};

// src/main.ts
async function run() {
  try {
    const token = core2.getInput("token", { required: true });
    const releaseTag = core2.getInput("releaseTag", { required: true });
    const latest = core2.getInput("latest", { required: true });
    const workflow = new WorkflowHandler(token, releaseTag);
    await workflow.processReleaseNotes(latest === "true");
    await workflow.processIssuesByTagLabel();
    await workflow.processMilestone();
    if (workflow.isProcessWithError()) {
      throw new Error("There were errors during the process. Check the logs for more information");
    }
    core2.info("Workflow completed");
  } catch (error2) {
    if (error2 instanceof Error) {
      core2.setFailed(error2.message);
    }
  }
}
void run();
