import { NextResponse } from "next/server";
import { auth } from "@/auth";

const STOCKS = [
  { code: "7203", name: "トヨタ" },
  { code: "6758", name: "ソニー" },
  { code: "9984", name: "ソフトバンクG" },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }

  const apiKey = process.env.JQUANTS_REFRESH_TOKEN ?? "";

  const results = [];
  for (const { code, name } of STOCKS) {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(
      `https://api.jquants.com/v2/equities/bars/daily?code=${code}`,
      { headers: { "x-api-key": apiKey } }
    );
    const data = await res.json();
    const quotes: { Date: string; O: number; C: number }[] = data.data ?? [];
    if (quotes.length === 0) { results.push(null); continue; }
    const latest = quotes[quotes.length - 1];
    const change = latest.C - latest.O;
    const changePercent = ((change / latest.O) * 100).toFixed(2);
    results.push({
      code,
      name,
      close: latest.C,
      change: change > 0 ? `+${change.toFixed(0)}` : change.toFixed(0),
      changePercent: change > 0 ? `+${changePercent}` : changePercent,
      positive: change >= 0,
      date: latest.Date,
    });
  }

  return NextResponse.json(results.filter(Boolean));
}
