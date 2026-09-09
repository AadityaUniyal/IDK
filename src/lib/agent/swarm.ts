// Specialized Multi-Agent Swarm Orchestrator
import { generateJSON, generateLLM } from "../ai/provider";
import { describeToolsForPlanner, getTool } from "../tools/registry";
import { queryMemories } from "./memory";
import { hybridVectorSearch } from "../vector";

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

export async function swarmPlanMission(objective: string, userId: string, sourcesDesc: string) {
  // Query past memories to inform architectural planning
  const memories = await queryMemories(userId, objective, 3);
  const memoryContext = memories.length > 0
    ? "\n\nRELEVANT PAST MEMORIES:\n" + memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join("\n")
    : "";

  const planPrompt = `USER OBJECTIVE:\n${objective}\n\nAVAILABLE DATA SOURCES:\n${sourcesDesc || "(none)"}${memoryContext}\n\nAVAILABLE TOOLS:\n${describeToolsForPlanner()}`;

  const plan = await generateJSON<any>({
    system: `${SWARM_ROLES.Architect.systemPrompt}\nRules:\n- Final task MUST use "generate_document" or "generate_chart".\n- Produce 4 to 8 explicit tasks.\n- Output strict JSON: {"goal": string, "title": string, "tasks": [{"id": string, "label": string, "description": string, "tool": string, "input": object, "dependsOn": string[], "risk": "low"|"medium"|"high"}]}`,
    prompt: planPrompt,
    maxTokens: 3500
  });

  return plan;
}

export async function swarmAuditTask(task: any): Promise<{ riskLevel: string; requiresApproval: boolean; rationale: string }> {
  const tool = getTool(String(task.tool));
  if (!tool) {
    return { riskLevel: "low", requiresApproval: false, rationale: "Default read-only tool" };
  }

  const isDestructive = tool.riskLevel === "destructive" || tool.riskLevel === "write" || tool.riskLevel === "external";
  if (isDestructive || task.risk === "high") {
    return {
      riskLevel: "high",
      requiresApproval: true,
      rationale: `Tool ${tool.name} categorized as ${tool.riskLevel} risk requires explicit human review.`
    };
  }

  return {
    riskLevel: task.risk || "low",
    requiresApproval: false,
    rationale: "Automated safety audit approved read-only execution."
  };
}
