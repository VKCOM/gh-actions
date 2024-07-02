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
var Figma = __toESM(require("figma-js"));
var core = __toESM(require("@actions/core"));
var fs = __toESM(require("fs/promises"));

// src/sort.ts
function isObject(value) {
  return typeof value === "object" && !(value instanceof Array);
}
function sortObjectRecursively(value) {
  if (!isObject(value)) return value;
  return Object.keys(value).sort().reduce((obj, key) => {
    obj[key] = sortObjectRecursively(value[key]);
    return obj;
  }, {});
}

// src/main.ts
function toSnack(s) {
  return s.replaceAll(/( – | )/g, "_");
}
function to16(n, padding = 2) {
  let hex = n.toString(16);
  while (hex.length < padding) {
    hex = "0" + hex;
  }
  return hex;
}
function color1To255(color) {
  return Math.round(255 * color);
}
function toHex(r, g, b) {
  return `#${to16(r)}${to16(g)}${to16(b)}`;
}
function toRGBA(r, g, b, a) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function figmaToCSS(color, opacity) {
  const r = color1To255(color.r);
  const g = color1To255(color.g);
  const b = color1To255(color.b);
  const a = opacity.toFixed(2);
  return a === "1.00" ? toHex(r, g, b) : toRGBA(r, g, b, a);
}
function recursiveTokens(tokens, path, value) {
  const key = toSnack(path[0]);
  if (path.length === 1) {
    tokens[key] = value;
  }
  const obj = tokens[key] || {};
  if (!(key in tokens)) {
    tokens[key] = obj;
  }
  if (typeof tokens[key] === "string") {
    return;
  }
  recursiveTokens(obj, path.slice(1), value);
}
var req = {
  required: true
};
function getFigmaClient(personalAccessToken) {
  return Figma.Client({
    personalAccessToken
  });
}
async function main() {
  const personalAccessToken = core.getInput("token", req);
  const fileId = core.getInput("file_key", req);
  const pathToJSON = core.getInput("output_file_name", req);
  const figma = getFigmaClient(personalAccessToken);
  const styles = await figma.fileStyles(fileId);
  if (styles.status !== 200) {
    core.error(styles.statusText, { title: "Figma get file styles" });
    process.exit(1);
  }
  const ids = styles.data.meta.styles.map((style) => style.node_id);
  const nodes = await figma.fileNodes(fileId, { ids });
  const tokens = {};
  styles.data.meta.styles.map((style) => {
    const doc = nodes.data.nodes[style.node_id]?.document;
    if (!doc) {
      core.warning(`document is undefined'`);
      return;
    }
    if (doc.type === "TEXT") {
      return;
    }
    if (doc.type !== "RECTANGLE") {
      core.warning(`doc.type is ${doc.type}'`);
      return;
    }
    if (doc.fills.length !== 1) {
      core.warning(`doc.fills.length=${doc.fills.length}`);
      return;
    }
    const splitPath = style.name.replace("VKUI \xB7 ", "").toLowerCase().split(/(\/| – )/g).filter((v) => v !== "/" && v !== " \u2013 ");
    let cssValue = "";
    switch (doc.fills[0].type) {
      case "SOLID":
        const fill = doc.fills[0];
        if (!fill.color) {
          break;
        }
        cssValue = figmaToCSS(fill.color, fill.opacity || 1);
        break;
      case "GRADIENT_LINEAR":
        break;
      default:
        core.warning(`fills.type=${doc.fills.length}`);
        core.debug(JSON.stringify(doc.fills));
        break;
    }
    if (cssValue === "") {
      return;
    }
    recursiveTokens(tokens, splitPath, cssValue);
  });
  await fs.writeFile(pathToJSON, JSON.stringify(sortObjectRecursively(tokens), void 0, 2));
}
main().then().catch((err) => {
  core.error(err.stack);
  core.setFailed(err.message);
});
