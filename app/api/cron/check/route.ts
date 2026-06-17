import { NextResponse } from "next/server";
import { redis, sendPush } from "@/lib/push";
import type { ScheduledNotification } from "@/app/api/cron/morning/route";

// Vercel Cron: 15分ごと
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const jstDate = jstNow.toISOString().split("T")[0];
  const jstTime = jstNow.toISOString().split("T")[1].slice(0, 5); // "HH:MM"

  const key = `notifications:schedule:${jstDate}`;
  const schedule = await redis.get<ScheduledNotification[]>(key);
  if (!schedule || schedule.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const toSend = schedule.filter(n => !n.sent && n.time <= jstTime);
  let sent = 0;

  const sub = await redis.get("push:subscription");
  if (!sub) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no subscription" });
  }

  for (const n of toSend) {
    try {
      await sendPush({ title: n.title, body: n.body, url: n.url });
      n.sent = true;
      sent++;
    } catch (e) {
      console.error("[cron/check] push failed:", e);
    }
  }

  if (sent > 0) {
    await redis.set(key, schedule, { ex: 86400 * 2 });
  }

  return NextResponse.json({ ok: true, sent });
}
