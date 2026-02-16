import Fastify from "fastify";

const server = Fastify({
  logger: {
    level: "info",
  },
});

server.get("/health", async () => {
  return { status: "ok", service: "preview-api" };
});

async function start(): Promise<void> {
  const port = parseInt(process.env["PORT"] ?? "3000", 10);
  const host = process.env["HOST"] ?? "0.0.0.0";

  await server.listen({ port, host });
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
