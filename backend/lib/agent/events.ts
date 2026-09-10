import { db } from "../db";

export async function appendEvent(missionId: string, type: string, payload: unknown = {}) {
  const payloadStr = JSON.stringify(payload ?? {});
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db()`
        INSERT INTO agent_events (mission_id, sequence_number, type, payload_json)
        VALUES (
          ${missionId},
          (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM agent_events WHERE mission_id = ${missionId}),
          ${type},
          ${payloadStr}
        )`;
      return;
    } catch (err: any) {
      if (attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}
