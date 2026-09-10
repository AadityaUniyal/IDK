// Deterministic permission engine. The LLM never grants itself authority:
// every tool call passes here BEFORE execution. Risk classes are fixed;
// workspace policies (agent_policies rows) and the mission's autonomy mode
// modulate write-class actions only. External/destructive always gate.

import { db, type SqlFn } from "../db";

export type PolicyAction = "execute" | "approve" | "skip";

export interface PolicyDecision {
  action: PolicyAction;
  requiresApproval: boolean;
  risk: "low" | "medium" | "high" | "critical";
  reason: string;
}

type ToolRisk = "read" | "analyze" | "write" | "external" | "destructive";

export async function evaluatePolicy(
  sql: SqlFn,
  opts: {
    toolName: string;
    toolRisk: ToolRisk;
    autonomyMode: string; // observe | assist | controlled_autonomous
    workspaceId: string | null;
  }
): Promise<PolicyDecision> {
  const { toolName, toolRisk, autonomyMode, workspaceId } = opts;

  // Workspace policy overrides (exact tool-name match first, then '*').
  if (workspaceId) {
    const policies = await sql`
      SELECT action_pattern, requires_approval FROM agent_policies
      WHERE workspace_id = ${workspaceId} AND enabled = true AND (action_pattern = ${toolName} OR action_pattern = '*')
      ORDER BY (action_pattern = ${toolName}) DESC LIMIT 1`;
    if (policies.length) return {
      action: policies[0].requires_approval ? "approve" : "execute",
      requiresApproval: Boolean(policies[0].requires_approval),
      risk: riskOf(toolRisk),
      reason: `Workspace policy "${policies[0].action_pattern}" requires_approval=${policies[0].requires_approval}`,
    };
  }

  switch (toolRisk) {
    case "read":
    case "analyze":
      return { action: "execute", requiresApproval: false, risk: riskOf(toolRisk), reason: "No side effects — automatic execution" };

    case "write": {
      if (autonomyMode === "controlled_autonomous") {
        return { action: "execute", requiresApproval: false, risk: "medium", reason: "Autonomy mode allows internal writes without approval (idempotent + logged)" };
      }
      if (autonomyMode === "observe") {
        return { action: "skip", requiresApproval: false, risk: "medium", reason: "Observe mode: the agent proposes but does not execute state-changing actions" };
      }
      return { action: "approve", requiresApproval: true, risk: "medium", reason: "Internal state change requires deliberate human authorization" };
    }

    case "external":
      return { action: "approve", requiresApproval: true, risk: "high", reason: "External communication sends data outward — approval mandatory" };

    case "destructive":
      return { action: "approve", requiresApproval: true, risk: "critical", reason: "Irreversible action — approval mandatory under all autonomy modes" };

    default:
      return { action: "approve", requiresApproval: true, risk: "high", reason: `Unknown risk class "${toolRisk}" — defaulting to approval` };
  }
}

function riskOf(r: ToolRisk): PolicyDecision["risk"] {
  switch (r) {
    case "read": return "low";
    case "analyze": return "low";
    case "write": return "medium";
    case "external": return "high";
    case "destructive": return "critical";
  }
}
