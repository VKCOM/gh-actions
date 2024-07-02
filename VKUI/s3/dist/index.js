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
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var core = __toESM(require("@actions/core"));
var import_client_s3 = require("@aws-sdk/client-s3");
var import_mime_types = require("mime-types");
var req = {
  required: true
};
var notReq = {
  required: false
};
function getFilesFromFolder(folderPath) {
  const fileList = [];
  const files = import_fs.default.readdirSync(folderPath, { withFileTypes: true });
  files.forEach((file) => {
    if (file.isDirectory()) {
      fileList.push(...getFilesFromFolder(import_path.default.join(folderPath, file.name)));
    } else {
      fileList.push(import_path.default.join(folderPath, file.name));
    }
  });
  return fileList;
}
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
var Action = class {
  constructor() {
    core.info("Initial S3");
    this.s3 = new import_client_s3.S3(configuration());
    this.bucket = core.getInput("awsBucket", req);
  }
  async upload(src, dist) {
    core.info("Command upload");
    const sourceDir = import_path.default.join(process.cwd(), src);
    const files = getFilesFromFolder(sourceDir);
    core.debug(`length ${files.length}`);
    await Promise.all(
      files.map((file) => {
        core.debug(`file: ${file}`);
        const fileStream = import_fs.default.createReadStream(file);
        const bucketPath = import_path.default.join(dist, import_path.default.relative(sourceDir, file));
        core.debug(`put ${files.length}`);
        return this.s3.putObject({
          Bucket: this.bucket,
          ACL: "public-read",
          Body: fileStream,
          Key: bucketPath,
          ContentType: (0, import_mime_types.lookup)(file) || "text/plain"
        });
      })
    );
  }
  async delete(prefix) {
    core.info("Command delete");
    core.debug("listObjectsV2");
    const data = await this.s3.listObjectsV2({
      Bucket: this.bucket,
      Prefix: prefix
    });
    if (!data.Contents) {
      core.info("Nothing to delete");
      return;
    }
    const objects = data.Contents.map((content) => {
      return { Key: content.Key };
    });
    core.debug("deleteObjects");
    core.debug(`length ${objects.length}`);
    await this.s3.deleteObjects({
      Bucket: this.bucket,
      Delete: {
        Objects: objects
      }
    });
  }
  async run() {
    const command = core.getInput("command", req);
    switch (command) {
      case "upload":
        const src = core.getInput("commandUploadSrc", req);
        const dist = core.getInput("commandUploadDist", req);
        await this.upload(src, dist);
        break;
      case "delete":
        const prefix = core.getInput("commandDeletePrefix", req);
        await this.delete(prefix);
        break;
      default:
        core.setFailed(`Invalid command: ${command}`);
        break;
    }
  }
};
var action = new Action();
action.run().then().catch((err) => {
  core.error(err.stack);
  core.setFailed(err.message);
});
