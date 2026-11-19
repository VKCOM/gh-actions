import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { S3 as S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type { HttpRequest } from '@smithy/protocol-http';
import { isNotUndefined } from '../../lib/isNotUndefined.ts';
import { measure } from '../../lib/timings.ts';
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
      requestHandler: new NodeHttpHandler({
        requestTimeout: 20_000,
      }),
      maxAttempts: 4,
    });
    // Some S3-compatible stores still require the legacy Content-MD5 header
    // on multi-object deletes. The AWS SDK no longer adds it in WHEN_REQUIRED
    // mode, so calculate it from the serialized XML request body.
    this.#s3.middlewareStack.add(
      (next, context) => async (args) => {
        if (context.commandName === 'DeleteObjectsCommand') {
          const request = args.request as HttpRequest;
          if (typeof request.body === 'string' || request.body instanceof Uint8Array) {
            request.headers['content-md5'] = createHash('md5')
              .update(request.body)
              .digest('base64');
          }
        }
        return next(args);
      },
      { name: 'deleteObjectsContentMd5', step: 'finalizeRequest' },
    );
    this.#bucket = bucket;
  }

  async upload(
    ctx: Context,
    src: Readable,
    key: string,
    contentType: string,
    { CacheControl, ContentLength }: S3Options = {},
  ): Promise<void> {
    await measure(
      ctx,
      's3.PutObject',
      () =>
        this.#s3.putObject(
          {
            Bucket: this.#bucket,
            ACL: 'public-read',
            Body: src,
            ContentLength,
            Key: key,
            ContentType: contentType,
            CacheControl,
          },
          { abortSignal: ctx.signal },
        ),
      key,
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
    const head = await measure(
      ctx,
      's3.HeadObject',
      () => this.#s3.headObject({ Bucket: this.#bucket, Key: srcKey }, { abortSignal: ctx.signal }),
      srcKey,
    );

    await measure(
      ctx,
      's3.CopyObject',
      () =>
        this.#s3.copyObject(
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
        ),
      destKey,
    );
  }

  async delete(ctx: Context, ...keys: string[]): Promise<void> {
    await measure(ctx, 's3.DeleteObjects', () =>
      this.#s3.deleteObjects(
        {
          Bucket: this.#bucket,
          Delete: {
            Objects: keys.map((Key) => ({
              Key,
            })),
          },
        },
        { abortSignal: ctx.signal },
      ),
    );
  }

  async list(ctx: Context, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const data = await measure(
        ctx,
        's3.ListObjectsV2',
        () =>
          this.#s3.listObjectsV2(
            {
              Bucket: this.#bucket,
              Prefix: prefix,
              ContinuationToken: continuationToken,
            },
            { abortSignal: ctx.signal },
          ),
        prefix,
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
