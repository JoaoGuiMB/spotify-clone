import { describe, test, expect } from "@jest/globals";
import { Service } from "../../../server/service";
import { Readable } from "stream";
import config from "../../../server/config";
const {
  pages: { homeHTML },
} = config;

describe("#Service", () => {
  test("getFileStream", async () => {
    const { stream, type } = await new Service().getFileStream(homeHTML);
    const expectedType = ".html";
    expect(type).toBe(expectedType);
    expect(stream).toBeInstanceOf(Readable);
  });
});
