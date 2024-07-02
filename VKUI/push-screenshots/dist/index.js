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
var core = __toESM(require("@actions/core"));
var exec = __toESM(require("@actions/exec"));
async function run() {
  try {
    let count = 18;
    async function retry(cb, onError) {
      while (true) {
        try {
          await cb();
          break;
        } catch (e) {
          console.error(e);
          count -= 1;
          if (count < 0) {
            throw e;
          }
          await onError();
        }
      }
    }
    await exec.exec("git", ["pull"]);
    await retry(
      async () => {
        await exec.exec("git", ["add", "./**/*.png"]);
        try {
          await exec.exec("git", ["diff-index", "--quiet", "HEAD"]);
        } catch (e) {
          await exec.exec("git", ["commit", "-m", `CHORE: Update screenshots`]);
        }
      },
      async () => {
        await exec.exec("git", ["pull", "--rebase", "--autostash"]);
      }
    );
    await retry(
      async () => {
        await exec.exec("git", ["push", "--verbose"]);
      },
      async () => {
        await exec.exec("git", ["pull", "--rebase"]);
      }
    );
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
void run();
