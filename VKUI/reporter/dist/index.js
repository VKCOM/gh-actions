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
var import_fs2 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
var core3 = __toESM(require("@actions/core"));

// src/jest.ts
var core = __toESM(require("@actions/core"));
var import_strip_ansi = __toESM(require("strip-ansi"));

// src/shared.ts
var import_promises = require("fs/promises");
var github = __toESM(require("@actions/github"));
function getPullRequestNumber() {
  const payload = github.context.payload.pull_request;
  if (!payload) {
    throw new Error("Not found PR number");
  }
  return payload.number;
}
async function parseFile(path4) {
  const file = await (0, import_promises.readFile)(path4, "utf-8");
  return JSON.parse(file);
}

// src/jest.ts
function getMessage({ failureMessages }) {
  return (0, import_strip_ansi.default)(failureMessages?.join("\n\n") ?? "");
}
function getTitle({ ancestorTitles, title }) {
  return ancestorTitles.concat(title).join(" > ");
}
function getLine({ location }) {
  return location?.line || 0;
}
function getColumn(result) {
  return result.location?.column || 0;
}
function getFile(fullPath) {
  return fullPath.replace(process.cwd(), "");
}
function reportFailed(fullPath, result) {
  const message = getMessage(result);
  const title = getTitle(result);
  const file = getFile(fullPath);
  const line = getLine(result);
  const column = getColumn(result);
  core.error(message, {
    title,
    file,
    startLine: line,
    endLine: line,
    startColumn: column,
    endColumn: column
  });
}
function checkResult(result) {
  result.assertionResults.filter(({ status }) => status === "failed").forEach((assertionResult) => reportFailed(result.name, assertionResult));
}
async function jest(lintPath) {
  try {
    const results = await parseFile(lintPath);
    if (results.success) {
      return;
    }
    results.testResults.filter(({ status }) => status === "failed").forEach(checkResult);
  } catch (err) {
    if (err instanceof Error) core.error(`Could not read test results: ${err.message}`);
  }
}

// src/lint.ts
var import_path = __toESM(require("path"));
var core2 = __toESM(require("@actions/core"));
var SEVERITY = {
  /**
   * Turn the rule off
   */
  OFF: 0,
  /**
   * Turn the rule on as a warning (doesn’t affect exit code)
   */
  WARN: 1,
  /**
   * Turn the rule on as an error (exit code is 1 when triggered)
   */
  ERROR: 2
};
function report(message, relPath) {
  const text = `${message.message} \`${message.ruleId}\``;
  const annotation = {
    title: "Lint",
    file: relPath,
    startLine: message.line,
    endLine: message.endLine,
    startColumn: message.column,
    endColumn: message.endColumn
  };
  if (message.severity === SEVERITY.ERROR) {
    core2.error(text, annotation);
  } else if (message.severity === SEVERITY.WARN) {
    core2.warning(text, annotation);
  }
}
async function lint(lintPath) {
  try {
    const lintReport = await parseFile(lintPath);
    for (const { messages, filePath } of lintReport) {
      const relPath = import_path.default.relative(process.cwd(), filePath);
      for (const message of messages) {
        report(message, relPath);
      }
    }
  } catch (err) {
    if (err instanceof Error) core2.error(`Could not read lint results: ${err.message}`);
  }
}

// src/playwrightReport.ts
var import_fs = require("fs");
var import_path2 = __toESM(require("path"));
var github3 = __toESM(require("@actions/github"));

// src/comment.ts
var github2 = __toESM(require("@actions/github"));
var commentPrefix = "<!--GitHub Comment Builder-->\n";
var GitHubCommentBuilder = class {
  constructor(gh, prNumber) {
    this.gh = gh;
    this.message = commentPrefix;
    this.prNumber = typeof prNumber === "number" ? prNumber : getPullRequestNumber();
  }
  /**
   * Добавляет текст к комментарию.
   */
  add(text) {
    this.message += text + "\n\n";
  }
  /**
   * Пытаемся найти уже существующий комментарий
   */
  async getCommentId() {
    const comments = await this.gh.rest.issues.listComments({
      ...github2.context.repo,
      issue_number: this.prNumber
    });
    const comment = comments.data.find((item) => item.body?.startsWith(commentPrefix));
    return comment?.id;
  }
  /**
   * Создает или редактирует комментарий
   */
  async write() {
    const comment_id = await this.getCommentId();
    if (this.message === commentPrefix) {
      if (comment_id) {
        await this.gh.rest.issues.deleteComment({
          ...github2.context.repo,
          comment_id
        });
      }
      return;
    }
    if (comment_id) {
      await this.gh.rest.issues.updateComment({
        ...github2.context.repo,
        comment_id,
        body: this.message
      });
      return;
    }
    await this.gh.rest.issues.createComment({
      ...github2.context.repo,
      issue_number: this.prNumber,
      body: this.message
    });
  }
};

// src/playwrightReport.ts
function hasFailedScreenshots() {
  const playwrightReportDirPath = import_path2.default.join(process.cwd(), "playwright-report");
  const playwrightReportDataDirPath = import_path2.default.join(playwrightReportDirPath, "data");
  const playwrightReportTracePathDir = import_path2.default.join(playwrightReportDirPath, "trace");
  const isDataDirExist = (0, import_fs.existsSync)(playwrightReportDataDirPath);
  const isTraceDirExist = (0, import_fs.existsSync)(playwrightReportTracePathDir);
  return isDataDirExist || isTraceDirExist;
}
async function playwrightReport(url, token, prNumber) {
  const gh = github3.getOctokit(token);
  const comment = new GitHubCommentBuilder(gh, prNumber);
  const message = ["## e2e tests\n\n"];
  if (hasFailedScreenshots()) {
    message.push("> \u26A0\uFE0F Some screenshots were failed. See Playwright Report. \n\n");
  }
  message.push(`<a href="${url}" target="_blank">Playwright Report</a>`.replace(/(^|\n) +/g, ""));
  comment.add(message.join(" "));
  await comment.write();
}

// src/main.ts
async function run() {
  try {
    const jobs = [];
    const lintResults = import_path3.default.join(process.cwd(), "lint-results.json");
    const testResults = import_path3.default.join(process.cwd(), "test-results.json");
    const a11yResults = import_path3.default.join(process.cwd(), "a11y-results.json");
    if (import_fs2.default.existsSync(lintResults)) {
      jobs.push(lint(lintResults));
    }
    if (import_fs2.default.existsSync(testResults)) {
      jobs.push(jest(testResults));
    }
    if (import_fs2.default.existsSync(a11yResults)) {
      jobs.push(jest(a11yResults));
    }
    const playwrightReportURL = core3.getInput("playwrightReportURL", { required: false });
    const token = core3.getInput("token", { required: false });
    const prNumberRaw = core3.getInput("prNumber", { required: false });
    if (playwrightReportURL && token) {
      const prNumber = prNumberRaw ? Number(prNumberRaw) : void 0;
      jobs.push(playwrightReport(playwrightReportURL, token, prNumber));
    }
    await Promise.all(jobs);
  } catch (error3) {
    if (error3 instanceof Error) {
      core3.setFailed(error3.message);
    }
  }
}
void run();
