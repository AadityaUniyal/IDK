import { NextResponse } from "next/server";
import { registry } from "@backend/tools/registry";
import { handle } from "@backend/api";

export async function GET() {
  return handle(async () => {
    return NextResponse.json({
      tools: registry.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        riskLevel: t.riskLevel,
      })),
    });
  });
}
