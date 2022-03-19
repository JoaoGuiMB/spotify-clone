import config from "./config.js";
import server from "./server.js";
import { logger } from "./util.js";

server.listen(config.port).on("listening", () => {
  logger.info(`Server running on port ${config.port}`);
});

process.on("uncaughtException", (error) =>
  logger.error(`uncaughtException happened:  ${error.stack || error}`)
);
process.on("uncaughtRejection", (error) =>
  logger.error(`uncaughtRejection happened: ${error.stack || error}`)
);
