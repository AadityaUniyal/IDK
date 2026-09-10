import { NextResponse } from "next/server";
import { getCurrentUser } from "@backend/auth";
import { handle } from "@backend/api";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  });
}
