import { NextResponse } from "next/server";
import { registry } from "@/lib/tools/registry";
import { handle } from "@/lib/api";

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
