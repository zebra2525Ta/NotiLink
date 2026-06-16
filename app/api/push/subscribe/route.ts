import { NextRequest, NextResponse } from "next/server";
import { redis, SUBSCRIPTION_KEY } from "@/lib/push";

export async function POST(req: NextRequest) {
  const sub = await req.json();
  await redis.set(SUBSCRIPTION_KEY, sub);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await redis.del(SUBSCRIPTION_KEY);
  return NextResponse.json({ ok: true });
}
