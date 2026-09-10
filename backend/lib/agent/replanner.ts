// Replanner: invoked when a task fails. The LLM may correct and retry the
// task, add compensating tasks, or give up — bounded by the mission's
// replan budget so failure loops can't burn tokens indefinitely.

import { generateJSON } from "../ai/provider";
import { describeToolsForPlanner, getTool } from "../tools/registry";
import { appendEvent } from "./events";
import { db } from "../db";

const MAX_REPLANS = 2;

const REPLANNER_SYSTEM = `You are TRACE's replanner. A planned task failed during execution.
Decide how to recover. Respond with strict JSON:
{"decision": "retry" | "add" | "give_up", "reason": string,
 "tasks": [{"label": string, "description": string, "tool": string, "input": object}]}
- "retry": one task, same tool as the failed one, with a corrected "input" object.
- "add": one or more NEW tasks (different or same tools) that work around the failure.
- "give_up": the mission cannot proceed usefully without this task.
Only use tools from the provided registry. Labels are short human-readable phrases.`;

export async function replanAfterFailure(sql: ReturnType<typeof db>, mission: any, failedTask: any, errorMessage: string): Promise<boolean> {
  const current = await sql`SELECT replan_count FROM missions WHERE id = ${mission.id}`;
  if ((current[0]?.replan_count ?? 0) >= MAX_REPLANS) {
    await appendEvent(mission.id, "REPLAN_SKIPPED", { reason: "Replan budget exhausted", taskId: failedTask.id });
    return false;
  }

  const completed = await sql`SELECT label, tool, output FROM mission_tasks WHERE mission_id = ${mission.id} AND status = 'completed' ORDER BY position`;
  const observations = completed
    .map((t: any, i: number) => `[#${i + 1}] ${t.label} (${t.tool}): ${String(t.output ?? "").slice(0, 400)}`)
    .join("\n");

  let plan: any;
  try {
    plan = await generateJSON<any>({
      system: REPLANNER_SYSTEM,
      prompt: `MISSION OBJECTIVE:\n${mission.objective}\n\nCOMPLETED TASK OBSERVATIONS:\n${observations || "(none)"}\n\nFAILED TASK:\nlabel: ${failedTask.label}\ntool: ${failedTask.tool}\ninput: ${JSON.stringify(failedTask.tool_input)}\nerror: ${errorMessage}\n\nAVAILABLE TOOLS:\n${describeToolsForPlanner()}`,
      maxTokens: 1500,
    }, { missionId: mission.id, purpose: "replan" });
  } catch (err) {
    await appendEvent(mission.id, "REPLAN_FAILED", { reason: err instanceof Error ? err.message : "replanner error" });
    return false;
  }

  const decision = String(plan?.decision ?? "give_up");
  await sql`UPDATE missions SET replan_count = replan_count + 1 WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "REPLAN", { reason: plan?.reason ?? decision, decision, failedTask: failedTask.label });

  if (decision === "give_up" || !Array.isArray(plan.tasks) || !plan.tasks.length) return false;

  const maxPos = await sql`SELECT COALESCE(MAX(position), -1) AS p FROM mission_tasks WHERE mission_id = ${mission.id}`;
  let pos = Number(maxPos[0]?.p ?? -1) + 1;
  let added = 0;
  for (const t of plan.tasks) {
    const tool = getTool(String(t.tool));
    if (!tool) continue;
    await sql`INSERT INTO mission_tasks (mission_id, label, description, tool, tool_input, depends_on, status, risk_level, requires_approval, position)
      VALUES (${mission.id}, ${String(t.label ?? "Recovery task").slice(0, 200)}, ${String(t.description ?? "").slice(0, 1000)},
      ${tool.name}, ${JSON.stringify(t.input ?? {})}, ${JSON.stringify([])}, ${"pending"}, ${tool.riskLevel === "write" ? "medium" : "low"},
      ${tool.riskLevel === "write" || tool.riskLevel === "external" || tool.riskLevel === "destructive"}, ${pos})`;
    pos++;
    added++;
  }
  return added > 0;
}
