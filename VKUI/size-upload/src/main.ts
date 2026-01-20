import * as crypto from 'node:crypto';
import * as path from 'node:path';

import * as core from '@actions/core';
import { type PutObjectCommandInput, S3, type S3ClientConfig } from '@aws-sdk/client-s3';
import { lookup } from 'mime-types';
import { getHashAndTimestamp } from './git';
import { getSizesFromJSON } from './size_limit';

const req = {
  required: true,
};

const notReq = {
  required: false,
};

function configuration(): S3ClientConfig {
  const accessKeyId = core.getInput('awsAccessKeyId', req);
  const secretAccessKey = core.getInput('awsSecretAccessKey', req);
  const region = core.getInput('awsRegion', notReq) || 'us-east-1';
  const endpoint = core.getInput('awsEndpoint', notReq) || undefined;

  return {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region,
    endpoint,
  };
}

type SizeCheckFilename = `${string}-${string}-${string}-${string}-${string}.csv`;

function generateSizeCheckFilename(): SizeCheckFilename {
  return `${crypto.randomUUID()}.csv`;
}

interface SizeCheck {
  filename: SizeCheckFilename;
}

type ListSizeCheck = Record<string, SizeCheck>;

class Action {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  public constructor() {
    core.info('Initial S3');
    this.s3 = new S3(configuration());
    this.bucket = core.getInput('awsBucket', req);
    this.keyPrefix = core.getInput('awsKeyPrefix', req);
  }

  private async putObject(key: string, body: PutObjectCommandInput['Body']) {
    core.debug(`putObject: ${key}`);

    return await this.s3.putObject({
      Bucket: this.bucket,
      ACL: 'public-read',
      Body: body,
      Key: key,
      ContentType: lookup(key) || 'text/plain',
    });
  }

  private async getObject(key: string): Promise<string> {
    const getObjectOutput = await this.s3.getObject({
      Bucket: this.bucket,
      Key: key,
    });

    if (!getObjectOutput.Body) {
      throw new Error(`Get ${key} object failed: body is undefined`);
    }

    return await getObjectOutput.Body.transformToString();
  }

  private get listSizeCheckPath(): string {
    return path.join(this.keyPrefix, 'list.json');
  }

  /**
   * Возвращает список csv файлов
   */
  private async listSizeCheck(): Promise<ListSizeCheck> {
    try {
      const rawString = await this.getObject(this.listSizeCheckPath);

      return JSON.parse(rawString);
    } catch (error) {
      core.warning('Get list size check is failed');
      if (!(error instanceof Error)) {
        throw error;
      }

      core.warning(error);
    }

    return {};
  }

  /**
   * Обновляет список csv файлов
   */
  private async updateListSizeCheck(data: ListSizeCheck) {
    await this.putObject(this.listSizeCheckPath, JSON.stringify(data));
  }

  /**
   * Создает csv базу, возвращает название файла
   */
  private async createSizeCheck(): Promise<SizeCheckFilename> {
    const filename = generateSizeCheckFilename();
    const key = path.join(this.keyPrefix, filename);

    const header = 'hash,timestamp,size\n';

    await this.putObject(key, header);

    return filename;
  }

  /**
   * Добавляет в csv строку
   */
  private async addInSizeCheck(filename: SizeCheckFilename, line: string) {
    const key = path.join(this.keyPrefix, filename);

    const file = await this.getObject(key);
    await this.putObject(key, `${file + line}\n`);

    return filename;
  }

  private async addSize() {
    let needUpdateList = false;
    const list = await this.listSizeCheck();

    const sizes = await getSizesFromJSON(core.getInput('sizePath', req));

    for await (const { name, size } of sizes) {
      const line = (await getHashAndTimestamp()) + size.toString();

      if (!(name in list)) {
        const filename = await this.createSizeCheck();
        list[name] = {
          filename,
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

  public async run() {
    await this.addSize();
  }
}

const action = new Action();

action
  .run()
  .then()
  .catch((err) => {
    if (!(err instanceof Error)) {
      core.warning('catch error, but is not instanceof Error');
      core.setFailed(String(err));
      return;
    }

    core.error(err.stack || 'Error stack is undefined');
    core.setFailed(err.message);
  });
