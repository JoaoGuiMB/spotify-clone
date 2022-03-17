import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import config from "../../../server/config.js";
import Server from "../../../server/server.js";
import superTest from "supertest";
import portfinder from "portfinder";
import { Transform } from "stream";
import { setTimeout } from "timers/promises";

const RETENTION_DATA_PERIOD = 200;

const {
  pages,
  location,
  constants: { CONTENT_TYPE },
} = config;

const getAvailablePort = portfinder.getPortPromise;

const expectedResponse = {
  result: "ok",
};

const possibleComands = {
  start: "start",
  stop: "stop",
};

describe("API E2E Suite Test", () => {
  function pipeAndReadStreamData(stream, onChunk) {
    const transform = new Transform({
      transform(chunck, enc, cb) {
        onChunk(chunck);
        cb(null, chunck);
      },
    });
    return stream.pipe(transform);
  }

  describe("client workflow", () => {
    async function getTestServer() {
      const getSuperTest = (port) => superTest(`http://localhost:${port}`);
      const port = await getAvailablePort();
      return new Promise((resolve, reject) => {
        const server = Server.listen(port)
          .once("listening", () => {
            const testServer = getSuperTest(port);
            const response = {
              testServer,
              kill() {
                server.close();
              },
            };
            return resolve(response);
          })
          .once("error", reject);
      });
    }

    function commandSender(testServer) {
      return {
        async send(command) {
          const response = await testServer
            .post("/controller")
            .send({ command });
          expect(response.text).toStrictEqual(JSON.stringify(expectedResponse));
        },
      };
    }

    test("it should not receive data stream if the process is not playing", async () => {
      const server = await getTestServer();
      const onChunk = jest.fn();

      pipeAndReadStreamData(server.testServer.get("/stream"), onChunk);

      await setTimeout(RETENTION_DATA_PERIOD);
      server.kill();

      expect(onChunk).not.toHaveBeenCalled();
    });

    test("it should receive data stream if the process is playing", async () => {
      const server = await getTestServer();
      const onChunk = jest.fn();
      pipeAndReadStreamData(server.testServer.get("/stream"), onChunk);
      const { send } = commandSender(server.testServer);

      await send(possibleComands.start);
      await setTimeout(RETENTION_DATA_PERIOD);
      await send(possibleComands.stop);

      const [[buffer]] = onChunk.mock.calls;

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      server.kill();
    });
  });
});
