import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startWorkers, stopWorkers } from "./workers/index.js";
import { closeQueues } from "./queue/index.js";
import { closeRedis } from "./queue/connection.js";

export async function buildApp(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  // Plugins
  await server.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? true,
  });

  await server.register(rawBody, {
    global: false,
    runFirst: true,
    encoding: "utf-8",
  });

  // Routes
  await server.register(healthRoutes);
  await server.register(webhookRoutes);

  return server;
}

async function start(): Promise<void> {
  const server = await buildApp();

  const port = parseInt(process.env["PORT"] ?? "3000", 10);
  const host = process.env["HOST"] ?? "0.0.0.0";

  startWorkers();

  const shutdown = async () => {
    server.log.info("Shutting down...");
    await stopWorkers();
    await closeQueues();
    await closeRedis();
    await server.close();
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  await server.listen({ port, host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
