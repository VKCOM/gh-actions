import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import { type PutObjectCommandInput, S3, type S3ClientConfig } from '@aws-sdk/client-s3';
import { lookup } from 'mime-types';

// Сколько файлов грузить параллельно. Мелкие ассеты (css/js) хорошо параллелятся,
// основная нагрузка — сеть/RPS, а не CPU/память.
const maxConcurrentUploadFiles = 4;

// Сколько раз повторять загрузку одного файла при transient-ошибках (5xx, таймаут, reset).
const maxRetries = 4;

const baseBackoffMs = 500;

const req = {
  required: true,
};

const notReq = {
  required: false,
};

function getFilesFromFolder(folderPath: string) {
  const fileList: string[] = [];

  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  files.forEach((file) => {
    if (file.isDirectory()) {
      fileList.push(...getFilesFromFolder(path.join(folderPath, file.name)));
    } else {
      fileList.push(path.join(folderPath, file.name));
    }
  });

  return fileList;
}

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
    requestHandler: {
      requestTimeout: 120000, // 2 minutes — single-PUT мелких файлов обычно быстрый,
      // но при всплесках RPS/сети даём запас. Ретраи покрывают остаток.
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };
}

class Action {
  private readonly s3: S3;
  private readonly bucket: string;

  public constructor() {
    core.info('Initial S3');
    this.s3 = new S3(configuration());
    this.bucket = core.getInput('awsBucket', req);
  }

  private async putObject(args: PutObjectCommandInput) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Каждый раз открываем свежий стрим: после ошибки/завершения
        // повторное чтение того же стрима ничего не даст.
        if (typeof args.Body === 'string' || args.Body instanceof Buffer) {
          return await this.s3.putObject(args);
        }
        // Для ReadStream пересоздаём поток перед каждой попыткой.
        const stream = args.Body as fs.ReadStream;
        if (attempt > 1) {
          // Закрываем прежний стрим: при ошибке до потребления (например,
          // сбой подписи/credentials) SDK его не закроет — копятся дескрипторы.
          stream.destroy();
          args.Body =
            typeof stream.path === 'string' ? fs.createReadStream(stream.path) : undefined;
        }
        return await this.s3.putObject(args);
      } catch (err) {
        lastError = err;

        // Не транзиентные ошибки (4xx, кроме 408/429) нет смысла ретраить.
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        const transient = status === undefined || status >= 500 || status === 408 || status === 429;

        if (!transient || attempt === maxRetries) {
          throw err;
        }

        const backoff = baseBackoffMs * 2 ** (attempt - 1);
        core.warning(
          `putObject attempt ${attempt}/${maxRetries} failed (status=${status}): ${(err as Error).message}. Retrying in ${backoff}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw lastError;
  }

  private async upload(src: string, dist: string) {
    core.info('Command upload');

    const sourceDir = path.join(process.cwd(), src);
    const files = getFilesFromFolder(sourceDir);

    core.debug(`length ${files.length}`);

    let done = 0;
    const startedAt = Date.now();

    // Пул конкурентности: держим не более maxConcurrentUploadFiles активных
    // запросов, не создавая все стримы заранее (экономим память на больших папках).
    const inflight = new Set<Promise<unknown>>();

    for (const file of files) {
      core.debug(`file: ${file}`);
      const fileStream = fs.createReadStream(file);
      const bucketPath = path.join(dist, path.relative(sourceDir, file));

      const task = this.putObject({
        Bucket: this.bucket,
        ACL: 'public-read',
        Body: fileStream,
        Key: bucketPath,
        ContentType: lookup(file) || 'text/plain',
      }).then((result) => {
        done++;
        if (done % 50 === 0 || done === files.length) {
          core.info(
            `uploaded ${done}/${files.length} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          );
        }
        return result;
      });

      inflight.add(task);
      // Убираем промис из пула по завершении. Ошибка не глушится — её пробросит
      // либо Promise.race в цикле, либо финальная обработка ниже.
      task.finally(() => inflight.delete(task));

      if (inflight.size >= maxConcurrentUploadFiles) {
        await Promise.race(inflight);
      }
    }

    // Дожидаемся хвоста. Если хоть один файл упал (даже после выхода из цикла
    // через Promise.race) — пробрасываем первую ошибку, но не бросаем висящие
    // unhandled rejections от остальных.
    return await this.awaitInflight(inflight);
  }

  private async awaitInflight(inflight: Set<Promise<unknown>>) {
    // Фиксируем снимок: task.finally выше удаляет элементы из inflight
    // во время ожидания, и итерировать меняющийся Set небезопасно.
    const outcomes = await Promise.allSettled([...inflight]);
    const failure = outcomes.find((o): o is PromiseRejectedResult => o.status === 'rejected');
    if (failure) {
      throw failure.reason;
    }
  }

  private async delete(prefix: string) {
    core.info('Command delete');

    core.debug('listObjectsV2');
    const data = await this.s3.listObjectsV2({
      Bucket: this.bucket,
      Prefix: prefix,
    });

    if (!data.Contents) {
      core.info('Nothing to delete');
      return;
    }

    const objects = data.Contents.map((content) => {
      return { Key: content.Key };
    });

    core.debug('deleteObjects');
    core.debug(`length ${objects.length}`);
    await this.s3.deleteObjects({
      Bucket: this.bucket,
      Delete: {
        Objects: objects,
      },
    });
  }

  public async run() {
    const command = core.getInput('command', req);

    switch (command) {
      case 'upload': {
        const src = core.getInput('commandUploadSrc', req);
        const dist = core.getInput('commandUploadDist', req);

        await this.upload(src, dist);
        break;
      }

      case 'delete': {
        const prefix = core.getInput('commandDeletePrefix', req);

        await this.delete(prefix);
        break;
      }

      default:
        core.setFailed(`Invalid command: ${command}`);
        break;
    }
  }
}

const action = new Action();

action
  .run()
  .then()
  .catch((err) => {
    core.error(err.stack);
    core.setFailed(err.message);
  });
