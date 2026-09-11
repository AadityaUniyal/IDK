// Specialized Multi-Agent Swarm Orchestrator
import { generateJSON } from "../ai/provider";
import { describeToolsForPlanner, getTool } from "../tools/registry";
import { queryMemories } from "./memory";
import { sanitizePromptInput } from "../ai/guard";

export interface AgentRole {
  name: string;
  systemPrompt: string;
}

export const SWARM_ROLES: Record<string, AgentRole> = {
  Architect: {
    name: "Architect Agent",
    systemPrompt: `You are TRACE Lead Architect Agent. Decompose user objectives into an optimal, cycle-free Directed Acyclic Graph (DAG) of actionable tasks.`
  },
  Research: {
    name: "Research Agent",
    systemPrompt: `You are TRACE Data & RAG Research Specialist Agent. Retrieve exact facts, vector excerpts, and data source rows without hallucination.`
  },
  Code: {
    name: "Code Execution Agent",
    systemPrompt: `You are TRACE Code & Logic Agent. Perform data calculations, numeric aggregations, and code verification.`
  },
  SafetyAudit: {
    name: "Safety & Audit Agent",
    systemPrompt: `You are TRACE Security & Guardrail Agent. Evaluate risk levels of proposed actions and enforce policy controls.`
  },
  Synthesizer: {
    name: "Synthesis Agent",
    systemPrompt: `You are TRACE Chief Investigation Synthesizer. Merge task observations, evidence, and RAG chunks into executive reports.`
  }
};

export async function swarmPlanMission(objective: string, userId: string, sourcesDesc: string, missionId?: string) {
  // Query past memories to inform architectural planning (best-effort).
  let memoryContext = "";
  try {
    const memories = await queryMemories(userId, objective, 3);
    memoryContext = memories.length > 0
      ? "\n\nRELEVANT PAST MEMORIES:\n" + memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join("\n")
      : "";
  } catch (e) {
    console.warn("Memory recall skipped:", e instanceof Error ? e.message : e);
  }

  const planPrompt = `USER OBJECTIVE:\n${objective}\n\nAVAILABLE DATA SOURCES:\n${sourcesDesc || "(none)"}${memoryContext}\n\nAVAILABLE TOOLS:\n${describeToolsForPlanner()}`;

  const plan = await generateJSON<any>({
    system: `${SWARM_ROLES.Architect.systemPrompt}\nRules:\n- Final task MUST use "generate_document" or "generate_chart".\n- Produce 4 to 8 explicit tasks.\n- "label" must be a short human-readable action phrase (e.g. "Read sales.csv"), never an id like "t1".\n- Output strict JSON: {"goal": string, "title": string, "tasks": [{"id": string, "label": string, "description": string, "tool": string, "input": object, "dependsOn": string[], "risk": "low"|"medium"|"high"}]}`,
    prompt: planPrompt,
    maxTokens: 3500
  }, { missionId, purpose: "plan" });

  return plan;
}

export async function swarmAuditTask(task: any): Promise<{ riskLevel: string; requiresApproval: boolean; rationale: string }> {
  const tool = getTool(String(task.tool));
  if (!tool) {
    return { riskLevel: "low", requiresApproval: false, rationale: "Default read-only tool" };
  }

  // Enforce Safety & Audit Agent injection guard
  const inputStr = JSON.stringify(task.input || {});
  const guard = sanitizePromptInput(inputStr);
  if (!guard.safe) {
    return {
      riskLevel: "high",
      requiresApproval: true,
      rationale: `SafetyAudit Agent flagged task: ${guard.reason}`,
    };
  }

  const isDestructive = tool.riskLevel === "destructive" || tool.riskLevel === "write" || tool.riskLevel === "external";
  if (isDestructive || task.risk === "high") {
    return {
      riskLevel: "high",
      requiresApproval: true,
      rationale: `Tool ${tool.name} categorized as ${tool.riskLevel} risk requires explicit human authorization.`,
    };
  }

  return {
    riskLevel: task.risk || "low",
    requiresApproval: false,
    rationale: "SafetyAudit Agent approved execution.",
  };
}
