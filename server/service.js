import fs from "fs";
import fsPromises from "fs/promises";
import { randomUUID } from "crypto";
import config from "./config.js";
import { join, extname } from "path";
import { PassThrough, Writable } from "stream";
import { once } from "events";
import streamsPromises from "stream/promises";

import Throttle from "throttle";
import childProcess from "child_process";
import { logger } from "./util.js";

const {
  dir: { publicDirectory },
  constants: { fallbackBitRate, englishCoversation, bitRateDivisor },
} = config;

export class Service {
  constructor() {
    this.clientStreams = new Map();
    this.currentSong = englishCoversation;
    this.currentBitRate = 0;
    this.throttleTransform = {};
    this.currentReadable = {};
  }

  createClientStream() {
    const id = randomUUID();
    const clientStream = new PassThrough();
    this.clientStreams.set(id, clientStream);
    return {
      id,
      clientStream,
    };
  }

  removeClientStream(id) {
    this.clientStreams.delete(id);
  }

  _executeSoxCommand(args) {
    return childProcess.spawn("sox", args);
  }

  async getBitRate(song) {
    try {
      const args = ["--i", "-B", song];
      const {
        stderr, // errors
        stdout, // logs
        stdin, // enviar daddos como stream
      } = this._executeSoxCommand(args);
      await Promise.all([once(stdout, "readable"), once(stderr, "readable")]);
      const [success, error] = [stdout, stdout].map((stream) => stream.read());
      if (error) {
        return await Promise.reject(error);
      }
      return success.toString().trim().replace(/k/, "000");
    } catch (error) {
      logger.error(`Deu ruim no bitrate: ${error}`);
      return fallbackBitRate;
    }
  }

  broadCast() {
    return new Writable({
      write: (chunck, enc, cb) => {
        for (const [key, stream] of this.clientStreams) {
          // if the client has disconnected, no send more data
          if (stream.writableEnded) {
            this.clientStreams.delete(key);
            continue;
          }
          stream.write(chunck);
        }
        cb();
      },
    });
  }

  async startStreaming() {
    logger.info(`Starting with ${this.currentSong}`);
    const bitRate =
      (this.currentBitRate = await this.getBitRate(this.currentSong)) /
      bitRateDivisor;
    const throttleTransform = (this.throttleTransform = new Throttle(bitRate));
    const songReadable = (this.currentReadable = this.createFileStream(
      this.currentSong
    ));
    return streamsPromises.pipeline(
      songReadable,
      throttleTransform,
      this.broadCast()
    );
  }

  stopStreaming() {
    this.throttleTransform?.end?.();
  }

  createFileStream(filename) {
    return fs.createReadStream(filename);
  }

  async getFileInfo(file) {
    const fullFilePath = join(publicDirectory, file);
    await fsPromises.access(fullFilePath);
    const fileType = extname(fullFilePath);
    return {
      type: fileType,
      name: fullFilePath,
    };
  }

  async getFileStream(file) {
    const { name, type } = await this.getFileInfo(file);
    return {
      stream: this.createFileStream(name),
      type,
    };
  }
}
