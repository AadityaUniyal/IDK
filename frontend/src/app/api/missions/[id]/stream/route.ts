import { NextRequest } from "next/server";
import { db } from "@backend/db";
import { getCurrentUser } from "@backend/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: missionId } = await params;
  const missions = await db()`SELECT * FROM missions WHERE id = ${missionId} AND user_id = ${user.id}`;
  if (!missions.length) {
    return new Response("Mission not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSeq = 0;
  let isAborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        if (isAborted) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          isAborted = true;
        }
      };

      sendEvent("connected", { missionId, timestamp: new Date().toISOString() });

      const interval = setInterval(async () => {
        if (isAborted) {
          clearInterval(interval);
          return;
        }

        try {
          const events = await db()`
            SELECT id, sequence_number, type, payload_json, created_at
            FROM agent_events
            WHERE mission_id = ${missionId} AND sequence_number > ${lastSeq}
            ORDER BY sequence_number ASC`;

          if (events.length) {
            for (const ev of events) {
              lastSeq = ev.sequence_number;
              sendEvent("agent_event", ev);
            }
          }

          const mRes = await db()`SELECT status FROM missions WHERE id = ${missionId}`;
          const currentStatus = mRes[0]?.status;

          if (["completed", "failed", "cancelled"].includes(currentStatus)) {
            sendEvent("mission_state", { status: currentStatus });
            clearInterval(interval);
            controller.close();
            isAborted = true;
          }
        } catch (err) {
          console.error("SSE stream polling error:", err);
        }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        isAborted = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
