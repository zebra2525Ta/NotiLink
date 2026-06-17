import { NextRequest, NextResponse } from "next/server";
import { redis, SUBSCRIPTION_KEY, TOKEN_KEY } from "@/lib/push";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  const sub = await req.json();
  await redis.set(SUBSCRIPTION_KEY, sub);
  if (session?.accessToken) {
    await redis.set(TOKEN_KEY, session.accessToken);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await redis.del(SUBSCRIPTION_KEY);
  await redis.del(TOKEN_KEY);
  return NextResponse.json({ ok: true });
}
