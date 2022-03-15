import { describe, test, expect } from "@jest/globals";
import { Controller } from "../../../server/controller";
import { Readable } from "stream";
import config from "../../../server/config";
const {
  pages: { homeHTML },
} = config;

describe("#Controller", () => {
  test("getFileStream", async () => {
    const { stream, type } = await new Controller().getFileStream(homeHTML);
    const expectedType = ".html";
    expect(type).toBe(expectedType);
    expect(stream).toBeInstanceOf(Readable);
  });
});
