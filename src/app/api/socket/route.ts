// Server-Sent Events endpoint. Clients open EventSource("/api/socket?topics=odds:update,bet:confirmed,...")
// Each message is `data: { topic, payload, at }\n\n`.

import { NextRequest } from "next/server";
import { subscribe, type EventTopic } from "@/lib/server/event-bus";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_TOPICS: EventTopic[] = [
  "odds:update", "market:update", "market:live", "market:finished",
  "bet:confirmed", "bet:settled", "bet:cancelled",
  "lp:settled", "lp:deposit",
  "feed:new", "quota:alert", "crash:state", "casino:win", "notification",
];

export async function GET(req: NextRequest) {
  // Touch store so simulators boot.
  store();

  const raw = req.nextUrl.searchParams.get("topics") ?? "";
  const topics: EventTopic[] = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is EventTopic => (ALL_TOPICS as string[]).includes(t));

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // closed
        }
      };
      // Initial hello
      send({ topic: "hello", payload: { topics, serverTime: Date.now() }, at: Date.now() });

      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(": hb\n\n")); } catch { /* closed */ }
      }, 20_000);

      const unsubscribe = subscribe(topics.length ? topics : "*", (evt) => {
        send(evt);
      });

      const abort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };

      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
