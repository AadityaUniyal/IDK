// Agent runtime — a self-healing, multi-agent parallel DAG state machine
// featuring vector RAG integration, episodic memory, deterministic policy
// enforcement, failure-triggered replanning, and evidence-linked claims.

import { db } from "../db";
import { generateJSON } from "../ai/provider";
import { describeToolsForPlanner, getTool, validateToolInput } from "../tools/registry";
import { swarmPlanMission, swarmAuditTask } from "./swarm";
import { indexDataSource, hybridVectorSearch } from "../vector";
import { extractAndPersistMissionInsights } from "./memory";
import { evaluatePolicy } from "./policy-engine";
import { replanAfterFailure } from "./replanner";
import { appendEvent } from "./events";

export { appendEvent };

type Sql = ReturnType<typeof db>;

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
  // Backfill workspace for policy evaluation on missions created before it was set.
  if (!mission.workspace_id) {
    const ws = await sql`SELECT workspace_id FROM workspace_members WHERE user_id = ${userId} LIMIT 1`;
    if (ws.length) {
      await sql`UPDATE missions SET workspace_id = ${ws[0].workspace_id} WHERE id = ${mission.id}`;
      mission.workspace_id = ws[0].workspace_id;
    }
  }

  const sources = await sql`SELECT id, name, type, content FROM data_sources WHERE user_id = ${userId} ORDER BY created_at DESC`;

  // Auto-index data sources into the vector store (best-effort).
  for (const s of sources as any[]) {
    try {
      await indexDataSource(s.id, s.name, s.content);
    } catch (e) {
      console.warn(`Vector indexing skipped for ${s.name}:`, e instanceof Error ? e.message : e);
    }
  }

  const sourceDesc = sources
    .map((s: any) => `- ${s.name} (${s.type}, ${s.content.length} chars${s.type === "csv" ? `, headers: ${s.content.split(/\r?\n/)[0]?.slice(0, 120)}` : ""})`)
    .join("\n");

  const plan = await swarmPlanMission(mission.objective, userId, sourceDesc, mission.id);

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
      ${"pending"}, ${audit.riskLevel}, ${audit.requiresApproval}, ${pos}) RETURNING id`;
    idToUuid.set(String(t.id ?? `t${pos + 1}`), inserted[0].id);
    pos++;
  }

  await sql`UPDATE missions SET normalized_goal = ${String(plan?.goal ?? mission.objective).slice(0, 1000)},
    title = ${String(plan?.title ?? mission.title).slice(0, 160)}, status = ${"running"}, started_at = now()
    WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "PLAN_CREATED", { goal: plan?.goal, taskCount: valid.length, tasks: valid.map((t: any) => t.label) });
  await appendEvent(mission.id, "MISSION_STARTED", { objective: mission.objective });
}

const SYNTH_SYSTEM = `You are TRACE's Chief Synthesis Agent. You produce the executive report AND the evidence-linked claims list.
Use ONLY the task observations and RAG context provided. Do not invent facts.
Respond with strict JSON:
{"report": "full markdown report with headings, tables where useful, and [#N] observation citations",
 "claims": [{"text": string, "confidence": number between 0 and 1, "supports": [observation numbers], "contradicts": [observation numbers]}]}
"supports"/"contradicts" list 1-based observation numbers from the TASK OBSERVATIONS list that back or conflict with the claim. Include 2-6 claims.`;

export async function stepMission(sql: Sql, mission: any, userId: string): Promise<{ status: string; advanced: boolean }> {
  // Requeue tasks stuck in "running" (e.g. a serverless function died mid-task).
  await sql`UPDATE mission_tasks SET status = ${"pending"}
    WHERE mission_id = ${mission.id} AND status = ${"running"} AND started_at < now() - interval '5 minutes'`;

  const tasks = await sql`SELECT * FROM mission_tasks WHERE mission_id = ${mission.id} ORDER BY position`;

  const waitingApproval = tasks.filter((t: any) => t.status === "waiting_approval");
  const blockedIds = new Set(waitingApproval.map((t: any) => t.id));

  const depsOf = (t: any): string[] => Array.isArray(t.depends_on) ? t.depends_on : JSON.parse(t.depends_on ?? "[]");

  // A dependency is satisfied when it is COMPLETED, or when it reached a
  // terminal failure/skip (the replanner already attempted recovery there).
  // Treating failures as resolved prevents permanent DAG deadlock — the
  // downstream task runs with whatever evidence the rest of the graph produced.
  const resolvedIds = new Set(
    tasks.filter((t: any) => ["completed", "failed", "skipped"].includes(t.status)).map((t: any) => t.id)
  );

  const dependsSatisfied = (t: any) => {
    return depsOf(t).every((d: string) => {
      const dep = tasks.find((x: any) => x.id === d);
      if (!dep) return true;
      return resolvedIds.has(dep.id);
    });
  };

  const isBlockedByWaiting = (t: any) => {
    const stack = [t.id];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const node = tasks.find((x: any) => x.id === cur);
      if (!node) continue;
      if (blockedIds.has(node.id) && node.id !== t.id) return true;
      for (const d of depsOf(node)) {
        const dep = tasks.find((x: any) => x.id === d);
        if (dep) stack.push(dep.id);
      }
    }
    return false;
  };

  // Identify ALL runnable tasks for parallel batch execution.
  const runnableTasks = tasks.filter(
    (t: any) => t.status === "pending" && dependsSatisfied(t) && !isBlockedByWaiting(t)
  );

  if (runnableTasks.length > 0) {
    let advancedAny = false;

    await Promise.allSettled(
      runnableTasks.map(async (next: any) => {
        const tool = getTool(next.tool);
        if (!tool) {
          await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${"Unknown tool: " + next.tool}, completed_at = now() WHERE id = ${next.id}`;
          await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, reason: `Unknown tool ${next.tool}` });
          advancedAny = true;
          return;
        }

        // ── Policy engine: the deterministic authority gate. ──
        const decision = await evaluatePolicy(sql, {
          toolName: tool.name,
          toolRisk: tool.riskLevel,
          autonomyMode: mission.autonomy_mode ?? "assist",
          workspaceId: mission.workspace_id ?? null,
        });

        if (decision.action === "skip") {
          await sql`UPDATE mission_tasks SET status = ${"skipped"}, output = ${"Skipped by policy: " + decision.reason}, completed_at = now() WHERE id = ${next.id}`;
          await appendEvent(mission.id, "TASK_SKIPPED", { taskId: next.id, reason: decision.reason });
          advancedAny = true;
          return;
        }
        if (decision.action === "approve") {
          const prior = await sql`SELECT status FROM approvals WHERE task_id = ${next.id} ORDER BY requested_at DESC LIMIT 1`;
          const status = prior[0]?.status as string | undefined;
          if (status === "approved") {
            // Deliberately authorized by the human — proceed to execution.
          } else if (status === "rejected") {
            await sql`UPDATE mission_tasks SET status = ${"skipped"}, completed_at = now() WHERE id = ${next.id}`;
            await appendEvent(mission.id, "TASK_SKIPPED", { taskId: next.id, reason: "Authorization denied" });
            advancedAny = true;
            return;
          } else {
            if (!status) {
              await sql`INSERT INTO approvals (mission_id, task_id, action_name, risk_level, reason)
                VALUES (${mission.id}, ${next.id}, ${`${tool.name}: ${next.label}`}, ${decision.risk}, ${decision.reason})`;
              await appendEvent(mission.id, "APPROVAL_REQUIRED", { taskId: next.id, action: `${tool.name}: ${next.label}`, risk: decision.risk });
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
        const attemptNumber = (next.retry_count ?? 0) + 1;
        const runRow = await sql`INSERT INTO task_runs (task_id, mission_id, attempt_number) VALUES (${next.id}, ${mission.id}, ${attemptNumber}) RETURNING id`;
        const runId = runRow[0].id;

        const startTime = Date.now();
        let toolInput = typeof next.tool_input === "string" ? JSON.parse(next.tool_input || "{}") : next.tool_input;

        try {
          toolInput = validateToolInput(tool.name, toolInput);
          const result = await tool.execute(toolInput, { userId, missionId: mission.id });
          const duration = Date.now() - startTime;

          await sql`UPDATE task_runs SET status = ${"ok"}, completed_at = now() WHERE id = ${runId}`;
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

          // ── Self-healing: LLM diagnoses the failure and corrects parameters. ──
          if (retryCount <= 2) {
            console.warn(`[TRACE Agent Self-Healing] Task ${next.label} failed (attempt ${retryCount}). Attempting LLM diagnostic parameter correction...`);
            try {
              const healedInput = await generateJSON<any>({
                system: `You are TRACE Self-Healing Agent. A tool call threw an error. Inspect the failed input and error message, then produce corrected parameters that satisfy the tool's documented input schema.`,
                prompt: `TOOL: ${tool.name}\nTOOL INPUT SCHEMA: ${JSON.stringify(tool.inputSchema)}\nFAILED INPUT: ${JSON.stringify(toolInput)}\nERROR: ${msg}\nRespond with strict JSON of corrected input only.`,
                maxTokens: 500
              }, { missionId: mission.id, purpose: "self-heal" });

              if (healedInput && typeof healedInput === "object" && Object.keys(healedInput).length > 0) {
                await sql`UPDATE task_runs SET status = ${"healed"}, completed_at = now(), error_message = ${msg.slice(0, 500)} WHERE id = ${runId}`;
                await sql`UPDATE mission_tasks SET status = ${"pending"}, retry_count = ${retryCount}, tool_input = ${JSON.stringify(healedInput)} WHERE id = ${next.id}`;
                await appendEvent(mission.id, "SELF_HEALING_ATTEMPT", { taskId: next.id, retryCount, originalError: msg.slice(0, 200), correctedInput: healedInput });
                advancedAny = true;
                return;
              }
            } catch (healingErr) {
              console.warn("Self healing synthesis failed:", healingErr);
            }
          }

          await sql`UPDATE task_runs SET status = ${"failed"}, completed_at = now(), error_message = ${msg.slice(0, 500)} WHERE id = ${runId}`;
          await sql`UPDATE mission_tasks SET status = ${"failed"}, output = ${msg}, completed_at = now() WHERE id = ${next.id}`;
          await sql`INSERT INTO tool_calls (mission_id, task_id, tool_name, input_json, output_text, status, duration_ms)
            VALUES (${mission.id}, ${next.id}, ${tool.name}, ${JSON.stringify(toolInput)}, ${msg}, ${"failed"}, ${duration})`;
          await appendEvent(mission.id, "TASK_FAILED", { taskId: next.id, label: next.label, reason: msg });

          // ── Replanning: recover the mission after permanent failure. ──
          const recovered = await replanAfterFailure(sql, mission, next, msg).catch(() => false);
          if (recovered) await sql`UPDATE missions SET status = ${"running"} WHERE id = ${mission.id}`;
          advancedAny = true;
        }
      })
    );

    return { status: "running", advanced: advancedAny };
  }

  const pending = tasks.filter((t: any) => t.status === "pending" || t.status === "waiting_approval" || t.status === "running");
  if (pending.length) {
    await sql`UPDATE missions SET status = ${"waiting_for_approval"} WHERE id = ${mission.id}`;
    return { status: "waiting_for_approval", advanced: false };
  }

  // All tasks terminal → synthesize report + claims (idempotent).
  const completed = tasks.filter((t: any) => t.status === "completed");
  const observations = completed
    .map((t: any, i: number) => `[#${i + 1}] Task "${t.label}" (${t.tool}):\n${String(t.output ?? "").slice(0, 1500)}`)
    .join("\n\n");

  // RAG search for supplementary semantic context before synthesis.
  let ragChunksText = "";
  try {
    const ragChunks = await hybridVectorSearch(mission.objective, 4);
    if (ragChunks.length > 0) {
      ragChunksText = "\n\nSEMANTIC RAG CONTEXT:\n" + ragChunks.map(c => `[Chunk from ${c.sourceName || 'Source'}]: ${c.content}`).join("\n\n");
    }
  } catch (ragErr) {
    console.warn("RAG retrieval prior to synthesis skipped:", ragErr);
  }

  const existingArt = await sql`SELECT id FROM artifacts WHERE mission_id = ${mission.id} AND title = ${`Mission report — ${mission.title}`}`;
  if (existingArt.length) {
    await sql`UPDATE missions SET status = ${"completed"}, completed_at = now() WHERE id = ${mission.id}`;
    return { status: "completed", advanced: false };
  }

  let synth: any = null;
  try {
    synth = await generateJSON<any>({
      system: SYNTH_SYSTEM,
      prompt: `MISSION OBJECTIVE:\n${mission.objective}\n\nNORMALIZED GOAL:\n${mission.normalized_goal ?? ""}\n\nTASK OBSERVATIONS (numbered — claim references use these numbers):\n${observations || "(no successful observations)"}${ragChunksText}`,
      maxTokens: 4000,
    }, { missionId: mission.id, purpose: "synthesize" });
  } catch (synthErr) {
    console.warn("Claims synthesis fell back to plain report:", synthErr);
  }

  const report = String(synth?.report ?? "").slice(0, 24000);
  const title = `Mission report — ${mission.title}`;
  if (report) {
    await sql`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${mission.id}, ${"report"}, ${title}, ${report})`;
  } else {
    // Plain-text fallback report.
    const fallback = await generateJSONSafeReport(mission, observations, ragChunksText, mission.id);
    await sql`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${mission.id}, ${"report"}, ${title}, ${fallback})`;
  }

  // ── Evidence-linked claims ──
  if (Array.isArray(synth?.claims) && synth.claims.length) {
    const missionEvidence = await sql`SELECT id, task_id FROM evidence WHERE mission_id = ${mission.id} ORDER BY created_at`;
    const evidenceByTask = new Map<string, string[]>();
    for (const e of missionEvidence as any[]) {
      if (!e.task_id) continue;
      evidenceByTask.set(e.task_id, [...(evidenceByTask.get(e.task_id) ?? []), e.id]);
    }
    for (const claim of synth.claims.slice(0, 8)) {
      let conf = Number(claim?.confidence);
      if (!Number.isFinite(conf)) conf = 0.5;
      if (conf > 1) conf = conf / 100;
      conf = Math.min(1, Math.max(0, conf));
      const text = String(claim?.text ?? "").slice(0, 600);
      if (!text) continue;
      const inserted = await sql`INSERT INTO claims (mission_id, text, confidence, status)
        VALUES (${mission.id}, ${text}, ${conf}, ${conf >= 0.7 ? "supported" : "uncertain"}) RETURNING id`;
      const linkRefs = async (nums: any, rel: string) => {
        for (const n of (Array.isArray(nums) ? nums : []).map(Number)) {
          const task = completed[n - 1];
          if (!task) continue;
          for (const eid of evidenceByTask.get(task.id) ?? []) {
            await sql`INSERT INTO claim_evidence (claim_id, evidence_id, relationship) VALUES (${inserted[0].id}, ${eid}, ${rel})
              ON CONFLICT DO NOTHING`.catch(() => {});
          }
        }
      };
      await linkRefs(claim?.supports, "supports");
      await linkRefs(claim?.contradicts, "contradicts");
      await appendEvent(mission.id, "CLAIM_CREATED", { text: text.slice(0, 120), confidence: conf });
    }
  }

  await sql`UPDATE missions SET status = ${"completed"}, completed_at = now() WHERE id = ${mission.id}`;
  await appendEvent(mission.id, "MISSION_COMPLETED", { artifactTitle: title });

  // Store findings in agent long-term memory (best-effort).
  await extractAndPersistMissionInsights(userId, mission.id, mission.objective, report || title);

  return { status: "completed", advanced: true };
}

async function generateJSONSafeReport(mission: any, observations: string, ragChunksText: string, missionId: string): Promise<string> {
  try {
    const { generateLLM } = await import("../ai/provider");
    const res = await generateLLM({
      system: `You are TRACE's Chief Synthesis Agent. Write a comprehensive executive markdown report answering the mission objective using task observations and evidence. Cite evidence references like [#1] where applicable. Do not invent facts.`,
      prompt: `MISSION OBJECTIVE:\n${mission.objective}\n\nTASK OBSERVATIONS:\n${observations || "(no successful observations)"}${ragChunksText}`,
      maxTokens: 3000,
    }, { missionId, purpose: "synthesize" });
    return res.text.slice(0, 24000);
  } catch {
    return `# Mission report — ${mission.title}\n\nThe mission's tasks finished but report synthesis was unavailable.\n\n## Observations\n${observations}`;
  }
}
