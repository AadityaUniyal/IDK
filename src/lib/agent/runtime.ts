// Agent runtime — a step-driven state machine. Each call to `stepMission`
// advances the mission by one unit of work (plan, execute one task, gate on
// approval, synthesize). This keeps it durable on serverless (Vercel)
// without background workers; the client drives stepping.

import { db } from "../db";
import { generateJSON, generateLLM } from "../ai/provider";
import { describeToolsForPlanner, getTool, type RiskLevel } from "../tools/registry";

type Sql = ReturnType<typeof db>;

export async function appendEvent(missionId: string, type: string, payload: unknown = {}) {
  await db()`INSERT INTO agent_events (mission_id, sequence_number, type, payload_json)
    VALUES (${missionId}, (SELECT COALESCE(MAX(sequence_number),0)+1 FROM agent_events WHERE mission_id = ${missionId}), ${type}, ${JSON.stringify(payload)})`;
}

const PLANNER_SYSTEM = `You are TRACE, a universal agentic investigation planner.
Given a user objective, available data sources, and available tools, produce a dynamic investigation plan.
Rules:
- The final task MUST use tool "generate_document" with a concrete markdown report plan: a "title" and a "content" field containing a structured markdown outline (section headings plus placeholders like "[evidence: ...]" to be filled from earlier task observations).
- Choose tools only from the provided list. Order tasks so dependencies are explicit.
- 4 to 8 tasks total. Reference actual source names when relevant. Task inputs must be valid for the tool's input schema.
- "label" must be a short human-readable action phrase (e.g. "Read sales.csv", "Summarize revenue by region"), never an id like "t1".
- Never claim results; only plan investigations.
Respond with strict JSON: {"goal": string, "title": string, "tasks": [{"id": string, "label": string, "description": string, "tool": string, "input": object, "dependsOn": string[], "risk": "low"|"medium"|"high"}]}
Task "id" fields must be "t1","t2",... in order, and dependsOn references them.`;

export async function planMission(sql: Sql, mission: any, userId: string) {
  const sources = await sql`SELECT name, type, content FROM data_sources WHERE user_id = ${userId} ORDER BY created_at DESC`;
  const sourceDesc = sources
    .map((s: any) => `- ${s.name} (${s.type}, ${s.content.length} chars${s.type === "csv" ? `, headers: ${s.content.split(/\r?\n/)[0]?.slice(0, 120)}` : ""})`)
    .join("\n");

  const plan = await generateJSON<any>({
    system: PLANNER_SYSTEM,
    prompt: `USER OBJECTIVE:\n${mission.objective}\n\nAVAILABLE DATA SOURCES:\n${sourceDesc || "(none uploaded)"}\n\nAVAILABLE TOOLS:\n${describeToolsForPlanner()}`,
    maxTokens: 3000,
  });

  const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const valid = tasks.filter((t: any) => getTool(String(t.tool)));
  if (!valid.length) throw new Error("Planner produced no executable tasks");

  let pos = 0;
  const idToUuid = new Map<string, string>();
  for (const t of valid as any[]) {
    const tool = getTool(String(t.tool))!;
    const requiresApproval = tool.riskLevel === "write" || tool.riskLevel === "external" || tool.riskLevel === "destructive" || t.risk === "high";
    const deps = (Array.isArray(t.dependsOn) ? t.dependsOn : []).map((d: string) => idToUuid.get(String(d)) ?? String(d));
    const inserted = await sql`INSERT INTO mission_tasks (mission_id, label, description, tool, tool_input, depends_on, status, risk_level, requires_approval, position)
      VALUES (${mission.id}, ${String(t.label ?? "Untitled task").slice(0, 200)}, ${String(t.description ?? "").slice(0, 1000)},
      ${tool.name}, ${JSON.stringify(t.input ?? {})}, ${JSON.stringify(deps)},
      ${"pending"}, ${String(t.risk ?? "low")}, ${requiresApproval}, ${pos}) RETURNING id`;
    idToUuid.set(String(t.id ?? `t${pos + 1}`), inserted[0].id);
    pos++;
  }

  await sql`UPDATE missions SET normalized_goal = ${String(plan?.goal ?? mission.objective).slice(0, 1000)},
    title = ${String(plan?.title ?? mission.title).slice(0, 160)}, status = ${"running"}, started_at = now()
    WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "PLAN_CREATED", { goal: plan?.goal, taskCount: valid.length });
  await appendEvent(mission.id, "MISSION_STARTED", { objective: mission.objective });
}

const SYNTH_SYSTEM = `You are TRACE's final synthesizer. Write a clear markdown report answering the mission objective using ONLY the provided task observations and evidence. Cite evidence references like [#1] where possible. Do not invent facts.`;

export async function stepMission(sql: Sql, mission: any, userId: string): Promise<{ status: string; advanced: boolean }> {
  const tasks = await sql`SELECT * FROM mission_tasks WHERE mission_id = ${mission.id} ORDER BY position`;

  // Waiting approvals block their dependents but not independent tasks.
  const waitingApproval = tasks.filter((t: any) => t.status === "waiting_approval");
  const completedIds = new Set(tasks.filter((t: any) => t.status === "completed").map((t: any) => t.id));
  const blockedIds = new Set(waitingApproval.map((t: any) => t.id));

  const dependsSatisfied = (t: any) => {
    const deps = Array.isArray(t.depends_on) ? t.depends_on : JSON.parse(t.depends_on ?? "[]");
    // depends_on stores planner ids (t1..tn) OR uuids; resolve both.
    const byPlannerId = new Map(tasks.map((x: any, i: number) => [`t${i + 1}`, x]));
    return deps.every((d: string) => {
      const dep = byPlannerId.get(d) ?? tasks.find((x: any) => x.id === d);
      if (!dep) return true;
      return completedIds.has(dep.id);
    });
  };

  const isBlockedByWaiting = (t: any) => {
    const deps = Array.isArray(t.depends_on) ? t.depends_on : JSON.parse(t.depends_on ?? "[]");
    const byPlannerId = new Map(tasks.map((x: any, i: number) => [`t${i + 1}`, x]));
    const stack = [t.id];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const node = tasks.find((x: any) => x.id === cur);
      if (!node) continue;
      if (blockedIds.has(node.id) && node.id !== t.id) return true;
      const nd = Array.isArray(node.depends_on) ? node.depends_on : JSON.parse(node.depends_on ?? "[]");
      for (const d of nd) {
        const dep = byPlannerId.get(d) ?? tasks.find((x: any) => x.id === d);
        if (dep) stack.push(dep.id);
      }
    }
    return false;
  };

  // Pick the next executable pending task.
  const next = tasks.find(
    (t: any) => t.status === "pending" && dependsSatisfied(t) && !isBlockedByWaiting(t)
  );

  if (next) {
    const tool = getTool(next.tool);
    if (!tool) {
      await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${"Unknown tool: " + next.tool}, completed_at = now() WHERE id = ${next.id}`;
      await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, reason: `Unknown tool ${next.tool}` });
      return { status: "running", advanced: true };
    }

    // Policy engine: approval gate before execution. No approval yet → create
    // one and pause. Unresolved/rejected → stay paused. Approved → proceed.
    if (next.requires_approval) {
      const prior = await sql`SELECT status FROM approvals WHERE task_id = ${next.id} ORDER BY requested_at DESC LIMIT 1`;
      const status = prior[0]?.status as string | undefined;
      if (status === "approved") {
        // fall through to execution
      } else if (status === "rejected") {
        await sql`UPDATE mission_tasks SET status = ${"skipped"}, completed_at = now() WHERE id = ${next.id}`;
        await appendEvent(mission.id, "TASK_SKIPPED", { taskId: next.id, reason: "Authorization denied" });
        return { status: "running", advanced: true };
      } else {
        if (!status) {
          await sql`INSERT INTO approvals (mission_id, task_id, action_name, risk_level, reason)
            VALUES (${mission.id}, ${next.id}, ${`${tool.name}: ${next.label}`}, ${String(next.risk_level)}, ${`Tool risk class "${tool.riskLevel}" requires deliberate human authorization under the current autonomy policy.`})`;
          await appendEvent(mission.id, "APPROVAL_REQUIRED", { taskId: next.id, action: `${tool.name}: ${next.label}` });
        }
        await sql`UPDATE mission_tasks SET status = ${"waiting_approval"} WHERE id = ${next.id}`;
        await sql`UPDATE missions SET status = ${"waiting_for_approval"} WHERE id = ${mission.id}`;
        return { status: "waiting_for_approval", advanced: true };
      }
    }

    await sql`UPDATE mission_tasks SET status = ${"running"}, started_at = now() WHERE id = ${next.id}`;
    await appendEvent(mission.id, "TASK_STARTED", { taskId: next.id, label: next.label });
    await appendEvent(mission.id, "TOOL_CALLED", { taskId: next.id, tool: tool.name });

    try {
      const result = await tool.execute(
        Array.isArray(next.tool_input) ? {} : next.tool_input,
        { userId, missionId: mission.id }
      );
      await sql`UPDATE mission_tasks SET status = ${"completed"}, output = ${result.output.slice(0, 8000)}, completed_at = now() WHERE id = ${next.id}`;
      await sql`INSERT INTO tool_calls (mission_id, task_id, tool_name, input_json, output_text, status)
        VALUES (${mission.id}, ${next.id}, ${tool.name}, ${JSON.stringify(next.tool_input)}, ${result.output.slice(0, 4000)}, ${"ok"})`;
      for (const ev of result.evidence ?? []) {
        await sql`INSERT INTO evidence (mission_id, task_id, source_id, source_type, location, excerpt)
          VALUES (${mission.id}, ${next.id}, ${ev.sourceId ?? null}, ${ev.sourceId ? "file" : "tool_result"}, ${ev.location ?? null}, ${String(ev.excerpt).slice(0, 1000)})`;
        await appendEvent(mission.id, "EVIDENCE_FOUND", { taskId: next.id, excerpt: String(ev.excerpt).slice(0, 200) });
      }
      await appendEvent(mission.id, "TASK_COMPLETED", { taskId: next.id, label: next.label });
      return { status: "running", advanced: true };
    } catch (err: any) {
      const msg = err?.message ?? "Tool execution failed";
      await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${msg}, completed_at = now() WHERE id = ${next.id}`;
      await sql`INSERT INTO tool_calls (mission_id, task_id, tool_name, input_json, output_text, status)
        VALUES (${mission.id}, ${next.id}, ${tool.name}, ${JSON.stringify(next.tool_input)}, ${msg}, ${"failed"})`;
      await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, reason: msg });
      return { status: "running", advanced: true };
    }
  }

  // No executable task remains. Any still pending/blocked waiting approvals?
  const pending = tasks.filter((t: any) => t.status === "pending" || t.status === "waiting_approval");
  if (pending.length) {
    await sql`UPDATE missions SET status = ${"waiting_for_approval"} WHERE id = ${mission.id}`;
    return { status: "waiting_for_approval", advanced: false };
  }

  // All tasks finished (some may have failed) — synthesize final report.
  const completed = tasks.filter((t: any) => t.status === "completed");
  const observations = completed
    .map((t: any, i: number) => `[#${i + 1}] Task "${t.label}" (${t.tool}):\n${String(t.output ?? "").slice(0, 1500)}`)
    .join("\n\n");

  const res = await generateLLM({
    system: SYNTH_SYSTEM,
    prompt: `MISSION OBJECTIVE:\n${mission.objective}\n\nNORMALIZED GOAL:\n${mission.normalized_goal ?? ""}\n\nTASK OBSERVATIONS:\n${observations || "(no successful observations)"}`,
    maxTokens: 2500,
  });

  const title = `Mission report — ${mission.title}`;
  await sql`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${mission.id}, ${"report"}, ${title}, ${res.text})`;
  await sql`UPDATE missions SET status = ${"completed"}, completed_at = now() WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "MISSION_COMPLETED", { artifactTitle: title });
  return { status: "completed", advanced: true };
}
