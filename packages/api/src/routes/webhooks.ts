import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getQueue, QUEUE_NAMES } from "../queue/index.js";

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Map GitHub webhook events to the appropriate BullMQ queue.
 */
function getQueueForEvent(
  event: string,
  action: string | undefined,
): string | null {
  switch (event) {
    case "pull_request":
      return QUEUE_NAMES.PR_INGESTION;
    case "issues":
      return QUEUE_NAMES.ISSUE_INGESTION;
    case "issue_comment":
    case "pull_request_review":
      return QUEUE_NAMES.PR_INGESTION;
    case "installation":
      if (action === "created") return QUEUE_NAMES.BATCH_SYNC;
      return null;
    default:
      return null;
  }
}

export async function webhookRoutes(server: FastifyInstance): Promise<void> {
  server.post(
    "/api/webhooks/github",
    { config: { rawBody: true } },
    async (request, reply) => {
      const signature = request.headers["x-hub-signature-256"];
      const event = request.headers["x-github-event"];
      const deliveryId = request.headers["x-github-delivery"];

      if (typeof signature !== "string" || typeof event !== "string") {
        return reply.code(400).send({ error: "Missing required headers" });
      }

      const secret = process.env["GITHUB_WEBHOOK_SECRET"];
      if (!secret) {
        request.log.error("GITHUB_WEBHOOK_SECRET not configured");
        return reply.code(500).send({ error: "Server misconfigured" });
      }

      const rawBody = request.rawBody;
      if (!rawBody) {
        return reply.code(400).send({ error: "Empty body" });
      }

      const bodyString =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

      if (!verifySignature(bodyString, signature, secret)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      const payload = request.body as Record<string, unknown>;
      const action =
        typeof payload["action"] === "string"
          ? payload["action"]
          : undefined;

      const queueName = getQueueForEvent(event, action);

      if (!queueName) {
        // GitHub expects 2xx for all delivered events
        return reply.code(200).send({ ignored: true, event, action });
      }

      const queue = getQueue(queueName);
      const job = await queue.add(`${event}.${action ?? "unknown"}`, {
        event,
        action,
        deliveryId,
        payload,
        receivedAt: new Date().toISOString(),
      });

      return reply.code(202).send({ id: job.id, queue: queueName });
    },
  );
}
