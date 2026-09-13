"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const readLines = require("../../lib/readLines");

describe("readLines", () => {
  const tempPath = path.join(os.tmpdir(), "obj2gltf-readLinesSpec.txt");

  beforeAll(() => {
    fs.writeFileSync(tempPath, "a\nb\nc\nd\ne\n");
  });

  afterAll(() => {
    fs.unlinkSync(tempPath);
  });

  it("reads every line", async () => {
    const received = [];
    await readLines(tempPath, function (line) {
      received.push(line);
    });
    expect(received).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("stops reading lines after the callback throws", async () => {
    const received = [];
    const expectedError = new Error("test error");
    let thrownError;
    try {
      await readLines(tempPath, function (line) {
        received.push(line);
        if (received.length === 2) {
          throw expectedError;
        }
      });
    } catch (error) {
      thrownError = error;
    }
    expect(thrownError).toBe(expectedError);
    expect(received).toEqual(["a", "b"]);
  });
});
