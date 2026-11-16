import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { S3 } from './s3.ts';

test('serializes Content-Length for generated streams without writing to S3', async (t) => {
  for (const [key, value] of Object.entries({
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    AWS_REGION: 'us-east-1',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const body = Buffer.from('Привет');
  const handle = t.mock.method(
    NodeHttpHandler.prototype,
    'handle',
    async (request: Parameters<NodeHttpHandler['handle']>[0]) => {
      assert.equal(request.headers['content-length'], String(body.length));
      let contents = '';
      for await (const chunk of request.body) contents += chunk;
      assert.equal(contents, body.toString());
      return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
    },
  );
  await new S3('test', undefined).upload(
    { signal: t.signal },
    Readable.from([body]),
    'index.js',
    'text/javascript',
    { ContentLength: body.length },
  );
  assert.equal(handle.mock.callCount(), 1);
});
