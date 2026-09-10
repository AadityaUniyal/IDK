import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy } from "../lib/agent/policy-engine";

// Mock SQL function returning empty policy array
const mockSql = (async () => []) as any;

describe("Policy Engine", () => {
  it("automatically allows read and analyze tools without approval", async () => {
    const readDecision = await evaluatePolicy(mockSql, {
      toolName: "read_file",
      toolRisk: "read",
      autonomyMode: "assist",
      workspaceId: null,
    });
    assert.equal(readDecision.action, "execute");
    assert.equal(readDecision.requiresApproval, false);
    assert.equal(readDecision.risk, "low");

    const analyzeDecision = await evaluatePolicy(mockSql, {
      toolName: "query_table",
      toolRisk: "analyze",
      autonomyMode: "assist",
      workspaceId: null,
    });
    assert.equal(analyzeDecision.action, "execute");
    assert.equal(analyzeDecision.requiresApproval, false);
  });

  it("handles write actions according to autonomy mode", async () => {
    // Assist mode requires approval for writes
    const assistDecision = await evaluatePolicy(mockSql, {
      toolName: "generate_chart",
      toolRisk: "write",
      autonomyMode: "assist",
      workspaceId: null,
    });
    assert.equal(assistDecision.action, "approve");
    assert.equal(assistDecision.requiresApproval, true);

    // Controlled autonomous mode executes writes automatically
    const autoDecision = await evaluatePolicy(mockSql, {
      toolName: "generate_chart",
      toolRisk: "write",
      autonomyMode: "controlled_autonomous",
      workspaceId: null,
    });
    assert.equal(autoDecision.action, "execute");
    assert.equal(autoDecision.requiresApproval, false);

    // Observe mode skips write actions
    const observeDecision = await evaluatePolicy(mockSql, {
      toolName: "generate_chart",
      toolRisk: "write",
      autonomyMode: "observe",
      workspaceId: null,
    });
    assert.equal(observeDecision.action, "skip");
    assert.equal(observeDecision.requiresApproval, false);
  });

  it("always requires approval for external and destructive tool risks", async () => {
    const externalDecision = await evaluatePolicy(mockSql, {
      toolName: "web_search",
      toolRisk: "external",
      autonomyMode: "controlled_autonomous",
      workspaceId: null,
    });
    assert.equal(externalDecision.action, "approve");
    assert.equal(externalDecision.requiresApproval, true);
    assert.equal(externalDecision.risk, "high");

    const destructiveDecision = await evaluatePolicy(mockSql, {
      toolName: "delete_db",
      toolRisk: "destructive",
      autonomyMode: "controlled_autonomous",
      workspaceId: null,
    });
    assert.equal(destructiveDecision.action, "approve");
    assert.equal(destructiveDecision.requiresApproval, true);
    assert.equal(destructiveDecision.risk, "critical");
  });

  it("applies workspace policy overrides when present", async () => {
    const mockPolicySql = (async () => [
      { action_pattern: "custom_write", requires_approval: false },
    ]) as any;

    const decision = await evaluatePolicy(mockPolicySql, {
      toolName: "custom_write",
      toolRisk: "write",
      autonomyMode: "assist",
      workspaceId: "ws-123",
    });

    assert.equal(decision.action, "execute");
    assert.equal(decision.requiresApproval, false);
  });
});
