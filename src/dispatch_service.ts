import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { InfraiError, infrai } from "./infrai_realtime.js";
import { decideFollowUp, followUpRequest, workspaceChannel, type PresenceMember } from "./work_order_presence.js";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const service = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/follow-up") {
    response.writeHead(404).end();
    return;
  }
  try {
    const input = followUpRequest.parse(await readJson(request));
    const channel = workspaceChannel(input.accountId);
    await infrai.realtime.channel.create({ channel, type: "presence", vendor: "tencent_im" });
    const members = await infrai.realtime.presence.get<PresenceMember[]>(channel);
    const decision = decideFollowUp(input, members);
    await infrai.realtime.publish({
      channel,
      event: "work-order.follow-up",
      data: { workOrderId: input.workOrderId, photoRef: input.photoRef, note: input.note, ...decision },
      account_id: input.accountId,
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ workOrderId: input.workOrderId, ...decision }));
  } catch (error) {
    const status = error instanceof InfraiError ? error.status : 400;
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid request" }));
  }
});

service.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`field-service dispatch listening on ${process.env.PORT ?? 3000}`);
});
