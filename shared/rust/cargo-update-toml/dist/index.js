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
var fs = __toESM(require("node:fs/promises"));
var core = __toESM(require("@actions/core"));

// src/versionStyle.ts
function countInstances(string, word) {
  return string.split(word).length - 1;
}
function versionStyle(version, newVersion) {
  if (version.indexOf(",") > 0) {
    return version;
  }
  const re = /[\d\.]+(?!\*)/;
  const match = version.match(re);
  if (match === null) {
    return version;
  }
  const subVersion = newVersion.split(".").slice(0, countInstances(match[0], ".") + 1).join(".");
  return version.replace(re, subVersion);
}

// src/registry.ts
var readline2 = __toESM(require("node:readline/promises"));
var https = __toESM(require("node:https"));

// src/getLastLine.ts
var readline = __toESM(require("node:readline/promises"));
function getLastLine(input) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface(input);
    let lastLine = "";
    rl.on("line", function(line) {
      lastLine = line;
    });
    rl.on("error", reject);
    rl.on("close", function() {
      resolve(lastLine);
    });
  });
}

// src/registry.ts
var HTTPStatusOK = 200;
async function get2(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== HTTPStatusOK) {
        response.resume();
        reject(new Error(`Get "${url}" failed. HTTP status is ${response.statusCode}`));
        return;
      }
      resolve(response);
    }).on("error", reject);
  });
}
function indexPackageURL(name) {
  const url = ["https://raw.githubusercontent.com/rust-lang/crates.io-index/master"];
  if (name.length <= 3) {
    url.push(name.length.toString(), name[0]);
  } else {
    url.push(name.substring(0, 2), name.substring(2, 4));
  }
  url.push(name);
  return url.join("/");
}
async function cargoRegistryLastIndexPackage(name) {
  const url = indexPackageURL(name);
  const stream = await get2(url);
  const lastLine = await getLastLine(stream);
  return JSON.parse(lastLine);
}

// src/main.ts
async function crateRegistryVersion(name) {
  const index = await cargoRegistryLastIndexPackage(name);
  return index.vers;
}
async function updateDependency(data, name) {
  const lastVersion = await crateRegistryVersion(name);
  const searchValue = new RegExp(
    `(${name}[\\s]+=[\\s\\n]+(\\{.*?version\\s+=\\s+|))"([\\d.]+)"`,
    "m"
  );
  const match = data.match(searchValue);
  if (match === null) {
    throw new Error("Dependency not found in Cargo.toml");
  }
  const replaceValue = `$1"${versionStyle(match[3], lastVersion)}"`;
  return data.replace(searchValue, replaceValue);
}
async function run() {
  try {
    const packages = core.getInput("packages", { required: true }).split(/[\n\,]/);
    const filepath = "Cargo.toml";
    const encoding = "utf8";
    const data = await fs.readFile(filepath, encoding);
    let result = data;
    for (const name of packages) {
      result = await updateDependency(result, name);
    }
    await fs.writeFile(filepath, result, encoding);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
void run();
