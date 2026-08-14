import { NextResponse } from "next/server";
import { readState, resetBoss } from "../../lib/bossState";

export async function GET() {
  return NextResponse.json(readState());
}

// Demo convenience: restart the shared boss without restarting the server.
export async function DELETE() {
  return NextResponse.json(resetBoss());
}
