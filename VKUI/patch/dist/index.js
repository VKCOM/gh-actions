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
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var core2 = __toESM(require("@actions/core"));
var exec3 = __toESM(require("@actions/exec"));
var github = __toESM(require("@actions/github"));
var import_semver = require("semver");

// src/message.ts
function getPatchInstructions(header, description, patch) {
  const { targetBranchRef, patchRefs, pullNumber } = patch;
  return `
## ${header}

${description}

> \u0414\u0430\u043B\u044C\u043D\u0435\u0439\u0448\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442 \u043A\u043E\u043D\u0442\u0440\u0438\u0431\u044C\u044E\u0442\u0435\u0440\u044B \u0438\u0437 \u0433\u0440\u0443\u043F\u043F\u044B @VKCOM/vkui-core

\u0427\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u043F\u0430\u043B\u043E \u0432 \u0432\u0435\u0442\u043A\u0443 ${targetBranchRef}, \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F:

1. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u0443\u044E \u0432\u0435\u0442\u043A\u0443 \u043E\u0442 ${targetBranchRef} \u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F cherry-pick

\`\`\`bash
git stash # \u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E
git fetch origin ${targetBranchRef}
git checkout -b patch/pr${pullNumber} origin/${targetBranchRef}

${patchRefs.map((pathRef) => {
    return [
      `git cherry-pick --no-commit ${pathRef}`,
      "git checkout HEAD **/__image_snapshots__/*.png",
      "git diff --quiet HEAD || git commit --no-verify --no-edit"
    ].join("\n");
  }).join("\n\n")}
\`\`\`

2. \u0418\u0441\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u044B, \u0441\u043B\u0435\u0434\u0443\u044F \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F\u043C \u0438\u0437 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430
3. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0432\u0435\u0442\u043A\u0443 \u043D\u0430 GitHub \u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u044B\u0439 PR \u0441 \u0432\u0435\u0442\u043A\u043E\u0439 ${targetBranchRef} (\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043B\u0435\u0439\u0431\u043B\u0430 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F!)

\`\`\`bash
git push --set-upstream origin patch/pr${pullNumber}
gh pr create --base ${targetBranchRef} --title "patch: pr${pullNumber}" --body "- patch #${pullNumber}"
\`\`\`
`;
}

// src/getMergeData.ts
var exec = __toESM(require("@actions/exec"));
var MINIMUM_MERGE_COMMIT_COUNT = 2;
async function getMergeData(gh, repo, pullNumber) {
  const pullRequest = await gh.rest.pulls.get({ ...repo, pull_number: pullNumber });
  const mergeCommitSHA = pullRequest.data.merge_commit_sha || "";
  let method = "merge";
  try {
    await exec.exec("git", ["show", "-s", "--pretty=%p", mergeCommitSHA], {
      listeners: {
        stdout: (dataRaw) => {
          const data = dataRaw.toString().trim().split(" ");
          method = data.length >= MINIMUM_MERGE_COMMIT_COUNT ? "merge" : "squash";
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
  return {
    method,
    mergeCommitSHA
  };
}

// src/stableBranchName.ts
function stableBranchName(semVer) {
  return `${semVer.major}.${semVer.minor}-stable`;
}

// src/getBooleanInput.ts
var core = __toESM(require("@actions/core"));
var trueValue = ["true", "True", "TRUE"];
var falseValue = ["false", "False", "FALSE"];
function getBooleanInput(name, options) {
  const val = core.getInput(name, options);
  if (!val) return false;
  if (trueValue.includes(val)) return true;
  if (falseValue.includes(val)) return false;
  throw new TypeError(
    `Input does not meet YAML 1.2 "Core Schema" specification: ${name}
Support boolean input list: \`true | True | TRUE | false | False | FALSE\``
  );
}

// src/main.ts
function getPrNumber() {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("Not found PR number");
  }
  return pullRequest.number;
}
function getStableBranchRef(directory) {
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf-8"));
  const semVer = new import_semver.SemVer(pkg.version);
  return stableBranchName(semVer);
}
function filterCommitByMessage(message) {
  if (message.includes("CHORE: Update screenshots")) {
    return false;
  }
  if (message.startsWith("Merge branch")) {
    return false;
  }
  return true;
}
function remoteRepository(token) {
  const {
    actor,
    repo: { owner, repo }
  } = github.context;
  return `https://${actor}:${token}@github.com/${owner}/${repo}`;
}
async function run() {
  try {
    const forked = github.context.payload.pull_request?.base.repo.id !== github.context.payload.pull_request?.head.repo.id;
    const token = core2.getInput("token", { required: true });
    const directory = core2.getInput("directory");
    const targetBranchInput = core2.getInput("targetBranch");
    const needScreenshots = getBooleanInput("needScreenshots");
    const pullNumber = getPrNumber();
    const gh = github.getOctokit(token);
    const mergeData = await getMergeData(gh, github.context.repo, pullNumber);
    const patchRefs = [];
    if (mergeData.method === "squash") {
      patchRefs.push(mergeData.mergeCommitSHA);
    } else {
      const patchCommits = await gh.rest.pulls.listCommits({
        ...github.context.repo,
        pull_number: pullNumber
      });
      patchRefs.push(
        ...patchCommits.data.filter((commit) => filterCommitByMessage(commit.commit.message)).map((commit) => commit.sha)
      );
    }
    const createComment = async (body) => {
      await gh.rest.issues.createComment({
        ...github.context.repo,
        issue_number: pullNumber,
        body
      });
    };
    const targetBranchRef = targetBranchInput ? targetBranchInput : getStableBranchRef(directory);
    if (forked) {
      const message = getPatchInstructions(
        "\u26A0\uFE0F Patch (forked repo)",
        `\u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432 \u0432\u0435\u0442\u043A\u0443 ${targetBranchRef}.`,
        {
          targetBranchRef,
          pullNumber,
          patchRefs
        }
      );
      await createComment(message);
      core2.warning(`\u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432 \u0432\u0435\u0442\u043A\u0443 ${targetBranchRef}`);
      return;
    }
    try {
      if (mergeData.method === "squash") {
        await exec3.exec("git", ["fetch", "--no-tags", "origin", targetBranchRef]);
        await exec3.exec("git", [
          "fetch",
          "--no-tags",
          // Перед переносом диффа коммита, фетчим этот коммит с флагом `--depth=2`, чтобы
          // перебить параметр `fetch-depth` у `@actions/checkout`, который по умолчанию равен 1.
          "--depth=2",
          "origin",
          ...patchRefs
        ]);
      } else {
        await exec3.exec("git", ["fetch", "--no-tags", "origin", targetBranchRef, ...patchRefs]);
      }
      await exec3.exec("git", ["checkout", targetBranchRef]);
      const revision = needScreenshots ? ":*" : ":!**/__image_snapshots__/*.png";
      for (const patchRef of patchRefs) {
        await exec3.exec("bash", [
          "-c",
          `git --no-pager format-patch ${patchRef} -1 --stdout -- '${revision}' | git am`
        ]);
      }
    } catch (e) {
      console.error(e);
      const message = getPatchInstructions(
        "\u274C Patch",
        `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0430 \u0432\u0435\u0442\u043A\u0435 ${targetBranchRef}.`,
        {
          targetBranchRef,
          pullNumber,
          patchRefs
        }
      );
      await createComment(message);
      throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0430 \u0432\u0435\u0442\u043A\u0435 ${targetBranchRef}`);
    }
    await exec3.exec("git", [
      "push",
      `${remoteRepository(token)}`,
      `HEAD:refs/heads/${targetBranchRef}`,
      "--verbose"
    ]);
  } catch (error) {
    if (error instanceof Error) {
      core2.setFailed(error.message);
    }
  }
}
void run();
