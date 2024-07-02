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
var core = __toESM(require("@actions/core"));
var exec = __toESM(require("@actions/exec"));
var github = __toESM(require("@actions/github"));
var import_semver = require("semver");
function stableBranchName(semVer) {
  return `${semVer.major}.${semVer.minor}-stable`;
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
    const token = core.getInput("token", { required: true });
    const directory = core.getInput("directory");
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf-8"));
    const semVer = new import_semver.SemVer(pkg.version);
    const zeroPatchVersion = 0;
    if (semVer.patch !== zeroPatchVersion) {
      return;
    }
    const stableBranchRef = stableBranchName(semVer);
    const remote = remoteRepository(token);
    await exec.exec("git", ["branch", stableBranchRef]);
    await exec.exec("git", ["push", `${remote}`, `HEAD:${stableBranchRef}`, "--verbose"]);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
void run();
