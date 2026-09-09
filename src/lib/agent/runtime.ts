// Agent runtime — a self-healing, multi-agent parallel DAG state machine
// featuring vector RAG integration, episodic memory, and automatic error diagnosis.

import { db } from "../db";
import { generateJSON, generateLLM } from "../ai/provider";
import { describeToolsForPlanner, getTool } from "../tools/registry";
import { swarmPlanMission, swarmAuditTask } from "./swarm";
import { indexDataSource, hybridVectorSearch } from "../vector";
import { extractAndPersistMissionInsights } from "./memory";

type Sql = ReturnType<typeof db>;

export async function appendEvent(missionId: string, type: string, payload: unknown = {}) {
  await db()`
    INSERT INTO agent_events (mission_id, sequence_number, type, payload_json)
    VALUES (
      ${missionId},
      (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM agent_events WHERE mission_id = ${missionId}),
      ${type},
      ${JSON.stringify(payload)}
    )
    ON CONFLICT (mission_id, sequence_number) DO UPDATE
    SET sequence_number = agent_events.sequence_number + 1,
        type = EXCLUDED.type,
        payload_json = EXCLUDED.payload_json`;
}

function hasCycle(tasks: any[]): boolean {
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, Array.isArray(t.dependsOn) ? t.dependsOn : []);
  }
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    recStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (dfs(neighbor)) return true;
    }
    recStack.delete(node);
    return false;
  }

  for (const t of tasks) {
    if (dfs(t.id)) return true;
  }
  return false;
}

export async function planMission(sql: Sql, mission: any, userId: string) {
  const sources = await sql`SELECT id, name, type, content FROM data_sources WHERE user_id = ${userId} ORDER BY created_at DESC`;
  
  // Auto-index data sources into vector store
  for (const s of sources as any[]) {
    try {
      await indexDataSource(s.id, s.name, s.content);
    } catch (e) {
      console.warn(`Vector indexing skipped for ${s.name}:`, e);
    }
  }

  const sourceDesc = sources
    .map((s: any) => `- ${s.name} (${s.type}, ${s.content.length} chars${s.type === "csv" ? `, headers: ${s.content.split(/\r?\n/)[0]?.slice(0, 120)}` : ""})`)
    .join("\n");

  const plan = await swarmPlanMission(mission.objective, userId, sourceDesc);

  const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const valid = tasks.filter((t: any) => getTool(String(t.tool)));
  if (!valid.length) throw new Error("Planner produced no executable tasks");

  if (hasCycle(valid)) {
    console.warn("DAG cycle detected; resetting dependencies to sequential fallback.");
    valid.forEach((t: any, idx: number) => {
      t.dependsOn = idx > 0 ? [`t${idx}`] : [];
    });
  }

  let pos = 0;
  const idToUuid = new Map<string, string>();
  for (const t of valid as any[]) {
    const audit = await swarmAuditTask(t);
    const deps = (Array.isArray(t.dependsOn) ? t.dependsOn : []).map((d: string) => idToUuid.get(String(d)) ?? String(d));
    const inserted = await sql`INSERT INTO mission_tasks (mission_id, label, description, tool, tool_input, depends_on, status, risk_level, requires_approval, position)
      VALUES (${mission.id}, ${String(t.label ?? "Untitled task").slice(0, 200)}, ${String(t.description ?? "").slice(0, 1000)},
      ${t.tool}, ${JSON.stringify(t.input ?? {})}, ${JSON.stringify(deps)},
      ${"pending"}, ${audit.riskLevel}, ${audit.requiresApproval ? 1 : 0}, ${pos}) RETURNING id`;
    idToUuid.set(String(t.id ?? `t${pos + 1}`), inserted[0].id);
    pos++;
  }

  await sql`UPDATE missions SET normalized_goal = ${String(plan?.goal ?? mission.objective).slice(0, 1000)},
    title = ${String(plan?.title ?? mission.title).slice(0, 160)}, status = ${"running"}, started_at = now()
    WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "PLAN_CREATED", { goal: plan?.goal, taskCount: valid.length });
  await appendEvent(mission.id, "MISSION_STARTED", { objective: mission.objective });
}

const SYNTH_SYSTEM = `You are TRACE's Chief Synthesis Agent. Write a comprehensive executive markdown report answering the mission objective using task observations, RAG vector chunks, and evidence. Cite evidence references like [#1] where applicable. Do not invent facts.`;

export async function stepMission(sql: Sql, mission: any, userId: string): Promise<{ status: string; advanced: boolean }> {
  const tasks = await sql`SELECT * FROM mission_tasks WHERE mission_id = ${mission.id} ORDER BY position`;

  const waitingApproval = tasks.filter((t: any) => t.status === "waiting_approval");
  const completedIds = new Set(tasks.filter((t: any) => t.status === "completed").map((t: any) => t.id));
  const blockedIds = new Set(waitingApproval.map((t: any) => t.id));

  const dependsSatisfied = (t: any) => {
    const deps = Array.isArray(t.depends_on) ? t.depends_on : JSON.parse(t.depends_on ?? "[]");
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

  // Identify ALL runnable tasks for Parallel Node Execution
  const runnableTasks = tasks.filter(
    (t: any) => t.status === "pending" && dependsSatisfied(t) && !isBlockedByWaiting(t)
  );

  if (runnableTasks.length > 0) {
    let advancedAny = false;

    // Execute runnable nodes concurrently in parallel batch
    await Promise.allSettled(
      runnableTasks.map(async (next: any) => {
        const tool = getTool(next.tool);
        if (!tool) {
          await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${"Unknown tool: " + next.tool}, completed_at = now() WHERE id = ${next.id}`;
          await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, reason: `Unknown tool ${next.tool}` });
          advancedAny = true;
          return;
        }

        const reqApproval = next.requires_approval === 1 || next.requires_approval === true;

        if (reqApproval) {
          const prior = await sql`SELECT status FROM approvals WHERE task_id = ${next.id} ORDER BY requested_at DESC LIMIT 1`;
          const status = prior[0]?.status as string | undefined;
          if (status === "approved") {
            // Authorized — continue to execution
          } else if (status === "rejected") {
            await sql`UPDATE mission_tasks SET status = ${"skipped"}, completed_at = now() WHERE id = ${next.id}`;
            await appendEvent(mission.id, "TASK_SKIPPED", { taskId: next.id, reason: "Authorization denied" });
            advancedAny = true;
            return;
          } else {
            if (!status) {
              await sql`INSERT INTO approvals (mission_id, task_id, action_name, risk_level, reason)
                VALUES (${mission.id}, ${next.id}, ${`${tool.name}: ${next.label}`}, ${String(next.risk_level)}, ${`Tool risk class "${tool.riskLevel}" requires deliberate human authorization under current autonomy policy.`})`;
              await appendEvent(mission.id, "APPROVAL_REQUIRED", { taskId: next.id, action: `${tool.name}: ${next.label}` });
            }
            await sql`UPDATE mission_tasks SET status = ${"waiting_approval"} WHERE id = ${next.id}`;
            await sql`UPDATE missions SET status = ${"waiting_for_approval"} WHERE id = ${mission.id}`;
            advancedAny = true;
            return;
          }
        }

        await sql`UPDATE mission_tasks SET status = ${"running"}, started_at = now() WHERE id = ${next.id}`;
        await appendEvent(mission.id, "TASK_STARTED", { taskId: next.id, label: next.label });
        await appendEvent(mission.id, "TOOL_CALLED", { taskId: next.id, tool: tool.name });

        const startTime = Date.now();
        let toolInput = typeof next.tool_input === "string" ? JSON.parse(next.tool_input || "{}") : next.tool_input;

        try {
          const result = await tool.execute(toolInput, { userId, missionId: mission.id });
          const duration = Date.now() - startTime;

          await sql`UPDATE mission_tasks SET status = ${"completed"}, output = ${result.output.slice(0, 8000)}, completed_at = now() WHERE id = ${next.id}`;
          await sql`INSERT INTO tool_calls (mission_id, task_id, tool_name, input_json, output_text, status, duration_ms)
            VALUES (${mission.id}, ${next.id}, ${tool.name}, ${JSON.stringify(toolInput)}, ${result.output.slice(0, 4000)}, ${"ok"}, ${duration})`;
          
          for (const ev of result.evidence ?? []) {
            await sql`INSERT INTO evidence (mission_id, task_id, source_id, source_type, location, excerpt)
              VALUES (${mission.id}, ${next.id}, ${ev.sourceId ?? null}, ${ev.sourceId ? "file" : "tool_result"}, ${ev.location ?? null}, ${String(ev.excerpt).slice(0, 1000)})`;
            await appendEvent(mission.id, "EVIDENCE_FOUND", { taskId: next.id, excerpt: String(ev.excerpt).slice(0, 200) });
          }
          await appendEvent(mission.id, "TASK_COMPLETED", { taskId: next.id, label: next.label, durationMs: duration });
          advancedAny = true;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          const msg = err?.message ?? "Tool execution failed";
          const retryCount = (next.retry_count || 0) + 1;

          // Self-Healing Diagnostic Retry Loop
          if (retryCount <= 2) {
            console.warn(`[TRACE Agent Self-Healing] Task ${next.label} failed (attempt ${retryCount}). Attempting LLM diagnostic parameter correction...`);
            try {
              const healedInput = await generateJSON<any>({
                system: `You are TRACE Self-Healing Agent. A tool call threw an error. Inspect the failed input and error message, then produce corrected parameters.`,
                prompt: `TOOL: ${tool.name}\nFAILED INPUT: ${JSON.stringify(toolInput)}\nERROR: ${msg}\nRespond with JSON of corrected input:`,
                maxTokens: 500
              });

              if (healedInput) {
                await sql`UPDATE mission_tasks SET retry_count = ${retryCount}, tool_input = ${JSON.stringify(healedInput)} WHERE id = ${next.id}`;
                await appendEvent(mission.id, "SELF_HEALING_ATTEMPT", { taskId: next.id, retryCount, originalError: msg, correctedInput: healedInput });
                advancedAny = true;
                return;
              }
            } catch (healingErr) {
              console.warn("Self healing synthesis failed:", healingErr);
            }
          }

          await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${msg}, completed_at = now() WHERE id = ${next.id}`;
          await sql`INSERT INTO tool_calls (mission_id, task_id, tool_name, input_json, output_text, status, duration_ms)
            VALUES (${mission.id}, ${next.id}, ${tool.name}, ${JSON.stringify(toolInput)}, ${msg}, ${"failed"}, ${duration})`;
          await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, reason: msg });
          advancedAny = true;
        }
      })
    );

    return { status: "running", advanced: advancedAny };
  }

  const pending = tasks.filter((t: any) => t.status === "pending" || t.status === "waiting_approval");
  if (pending.length) {
    await sql`UPDATE missions SET status = ${"waiting_for_approval"} WHERE id = ${mission.id}`;
    return { status: "waiting_for_approval", advanced: false };
  }

  const completed = tasks.filter((t: any) => t.status === "completed");
  const observations = completed
    .map((t: any, i: number) => `[#${i + 1}] Task "${t.label}" (${t.tool}):\n${String(t.output ?? "").slice(0, 1500)}`)
    .join("\n\n");

  // RAG Search for supplementary evidence before report synthesis
  let ragChunksText = "";
  try {
    const ragChunks = await hybridVectorSearch(mission.objective, 4);
    if (ragChunks.length > 0) {
      ragChunksText = "\n\nSEMANTIC RAG CONTEXT:\n" + ragChunks.map(c => `[Chunk from ${c.sourceName || 'Source'}]: ${c.content}`).join("\n\n");
    }
  } catch (ragErr) {
    console.warn("RAG retrieval prior to synthesis skipped:", ragErr);
  }

  const res = await generateLLM({
    system: SYNTH_SYSTEM,
    prompt: `MISSION OBJECTIVE:\n${mission.objective}\n\nNORMALIZED GOAL:\n${mission.normalized_goal ?? ""}\n\nTASK OBSERVATIONS:\n${observations || "(no successful observations)"}${ragChunksText}`,
    maxTokens: 3000,
  });

  const title = `Executive Mission Report — ${mission.title}`;
  await sql`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${mission.id}, ${"report"}, ${title}, ${res.text})`;
  await sql`UPDATE missions SET status = ${"completed"}, completed_at = now() WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "MISSION_COMPLETED", { artifactTitle: title });

  // Store findings in agent long-term memory
  await extractAndPersistMissionInsights(userId, mission.id, mission.objective, res.text);

  return { status: "completed", advanced: true };
}
