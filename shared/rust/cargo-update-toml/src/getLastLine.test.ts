import * as assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { getLastLine } from "./getLastLine.ts";

describe("getLastLine", () => {
  it("returns the last line from a stream", async () => {
    const stream = new Readable();

    stream.push([1, 2, 3, 4].join("\n"));
    stream.push(null);

    const result = await getLastLine(stream);
    assert.strictEqual(result, "4");
  });
});
