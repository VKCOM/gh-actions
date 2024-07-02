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
var path = __toESM(require("node:path"));
var crypto = __toESM(require("node:crypto"));
var core = __toESM(require("@actions/core"));
var import_client_s3 = require("@aws-sdk/client-s3");
var import_mime_types = require("mime-types");

// src/size_limit.ts
var fs = __toESM(require("node:fs/promises"));
async function getSizesFromJSON(path2) {
  const buf = await fs.readFile(path2);
  return JSON.parse(buf.toString());
}

// src/git.ts
var exec = __toESM(require("@actions/exec"));
async function getHashAndTimestamp() {
  const output = await exec.getExecOutput("git", [
    "show",
    "HEAD",
    '--pretty=format:"%H,%at,"',
    "--no-patch"
  ]);
  return output.stdout;
}

// src/main.ts
var req = {
  required: true
};
var notReq = {
  required: false
};
function configuration() {
  const accessKeyId = core.getInput("awsAccessKeyId", req);
  const secretAccessKey = core.getInput("awsSecretAccessKey", req);
  const region = core.getInput("awsRegion", notReq) || "us-east-1";
  const endpoint = core.getInput("awsEndpoint", notReq) || void 0;
  return {
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    region,
    endpoint
  };
}
function generateSizeCheckFilename() {
  return `${crypto.randomUUID()}.csv`;
}
var Action = class {
  constructor() {
    core.info("Initial S3");
    this.s3 = new import_client_s3.S3(configuration());
    this.bucket = core.getInput("awsBucket", req);
    this.keyPrefix = core.getInput("awsKeyPrefix", req);
  }
  async putObject(key, body) {
    core.debug(`putObject: ${key}`);
    return await this.s3.putObject({
      Bucket: this.bucket,
      ACL: "public-read",
      Body: body,
      Key: key,
      ContentType: (0, import_mime_types.lookup)(key) || "text/plain"
    });
  }
  async getObject(key) {
    const getObjectOutput = await this.s3.getObject({
      Bucket: this.bucket,
      Key: key
    });
    if (!getObjectOutput.Body) {
      throw new Error(`Get ${key} object failed: body is undefined`);
    }
    return await getObjectOutput.Body.transformToString();
  }
  get listSizeCheckPath() {
    return path.join(this.keyPrefix, "list.json");
  }
  /**
   * Возвращает список csv файлов
   */
  async listSizeCheck() {
    try {
      const rawString = await this.getObject(this.listSizeCheckPath);
      return JSON.parse(rawString);
    } catch (error2) {
      core.warning("Get list size check is failed");
      if (!(error2 instanceof Error)) {
        throw error2;
      }
      core.warning(error2);
    }
    return {};
  }
  /**
   * Обновляет список csv файлов
   */
  async updateListSizeCheck(data) {
    await this.putObject(this.listSizeCheckPath, JSON.stringify(data));
  }
  /**
   * Создает csv базу, возвращает название файла
   */
  async createSizeCheck() {
    const filename = generateSizeCheckFilename();
    const key = path.join(this.keyPrefix, filename);
    const header = "hash,timestamp,size\n";
    await this.putObject(key, header);
    return filename;
  }
  /**
   * Добавляет в csv строку
   */
  async addInSizeCheck(filename, line) {
    const key = path.join(this.keyPrefix, filename);
    const file = await this.getObject(key);
    await this.putObject(key, file + line + "\n");
    return filename;
  }
  async addSize() {
    let needUpdateList = false;
    const list = await this.listSizeCheck();
    const sizes = await getSizesFromJSON(core.getInput("sizePath", req));
    for await (const { name, size } of sizes) {
      const line = await getHashAndTimestamp() + size.toString();
      if (!list.hasOwnProperty(name)) {
        const filename2 = await this.createSizeCheck();
        list[name] = {
          filename: filename2
        };
        needUpdateList = true;
      }
      const filename = list[name].filename;
      await this.addInSizeCheck(filename, line);
    }
    if (needUpdateList) {
      await this.updateListSizeCheck(list);
    }
  }
  async run() {
    await this.addSize();
  }
};
var action = new Action();
action.run().then().catch((err) => {
  if (!(err instanceof Error)) {
    core.warning("catch error, but is not instanceof Error");
    core.setFailed(String(err));
    return;
  }
  core.error(err.stack || "Error stack is undefined");
  core.setFailed(err.message);
});
