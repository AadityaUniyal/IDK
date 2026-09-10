import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculate, executeCode } from "../lib/tools/registry";

describe("Tool Registry & Execution Safety", () => {
  it("calculates numeric math expressions deterministically", async () => {
    const res = await calculate.execute({ expression: "(100 - 25) / 5" }, { userId: "u1", missionId: "m1" });
    assert.equal(res.output, "(100 - 25) / 5 = 15");
  });

  it("rejects non-numeric characters in calculate tool", async () => {
    await assert.rejects(
      async () => calculate.execute({ expression: "process.exit(1)" }, { userId: "u1", missionId: "m1" }),
      /Only numeric arithmetic expressions are allowed/
    );
  });

  it("evaluates safe data transformations in execute_code tool", async () => {
    const res = await executeCode.execute({ code: "const a = [1, 2, 3]; return a.map(x => x * 2);" }, { userId: "u1", missionId: "m1" });
    assert.ok(res.output.includes("[\n  2,\n  4,\n  6\n]"));
  });

  it("blocks dangerous keyword injection attempts in execute_code tool", async () => {
    const maliciousInputs = [
      "return process.env;",
      "return global.process;",
      "return eval('process.exit()');",
      "return Function('return process')()",
      "return require('fs');",
      "return import('fs');",
      "return this.constructor.constructor('return process')()",
      "return Object.prototype;",
    ];

    for (const code of maliciousInputs) {
      await assert.rejects(
        async () => executeCode.execute({ code }, { userId: "u1", missionId: "m1" }),
        /Security policy error: code contains prohibited pattern/
      );
    }
  });
});
