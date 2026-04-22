import type { Readable } from 'node:stream';
import { S3 as S3Client } from '@aws-sdk/client-s3';
import { isNotUndefined } from '../../lib/isNotUndefined.ts';
import type { Context } from '../entities/context.ts';
import type { S3Options, S3Repository } from '../entities/repositories.ts';

export class S3 implements S3Repository {
  readonly #s3: S3Client;
  readonly #bucket: string;

  constructor(bucket: string, profile: string | undefined) {
    this.#s3 = new S3Client({
      ...(profile && { profile }),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.#bucket = bucket;
  }

  async upload(
    ctx: Context,
    src: Readable,
    key: string,
    contentType: string,
    { CacheControl }: S3Options = {},
  ): Promise<void> {
    await this.#s3.putObject(
      {
        Bucket: this.#bucket,
        ACL: 'public-read',
        Body: src,
        Key: key,
        ContentType: contentType,
        CacheControl,
      },
      { abortSignal: ctx.signal },
    );

    return;
  }

  async copy(
    ctx: Context,
    srcKey: string,
    destKey: string,
    { CacheControl }: S3Options = {},
  ): Promise<void> {
    // Получаем метаданные исходного объекта для сохранения ContentType
    const head = await this.#s3.headObject(
      { Bucket: this.#bucket, Key: srcKey },
      { abortSignal: ctx.signal },
    );

    await this.#s3.copyObject(
      {
        Bucket: this.#bucket,
        CopySource: `${this.#bucket}/${srcKey}`,
        Key: destKey,
        ACL: 'public-read',
        MetadataDirective: 'REPLACE',
        CacheControl: head.CacheControl,
        ContentType: head.ContentType,
        ...(CacheControl && { CacheControl }),
      },
      { abortSignal: ctx.signal },
    );
  }

  async delete(ctx: Context, ...keys: string[]): Promise<void> {
    await this.#s3.deleteObjects(
      {
        Bucket: this.#bucket,
        Delete: {
          Objects: keys.map((Key) => ({
            Key,
          })),
        },
      },
      { abortSignal: ctx.signal },
    );
  }

  async list(ctx: Context, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const data = await this.#s3.listObjectsV2(
        {
          Bucket: this.#bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        },
        { abortSignal: ctx.signal },
      );

      if (data.Contents !== undefined) {
        keys.push(...data.Contents.map((v) => v.Key).filter(isNotUndefined));
      }

      continuationToken = data.IsTruncated ? data.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);

    return keys;
  }
}

export class S3Console implements S3Repository {
  async upload(_ctx: Context, _src: Readable, key: string, _contentType: string): Promise<void> {
    console.log(`s3: upload(${key})`);
    return;
  }

  async copy(_ctx: Context, srcPrefix: string, distPrefix: string): Promise<void> {
    console.log(`s3: copy(${srcPrefix} -> ${distPrefix})`);
    return;
  }

  async delete(_ctx: Context, ...keys: string[]): Promise<void> {
    console.log(`s3: delete(${keys})`);
    return;
  }

  async list(): Promise<string[]> {
    const l: string[] = [];
    return l;
  }
}
