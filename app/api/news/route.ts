import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }

  const res = await fetch(
    `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&country=jp&language=ja&size=5`
  );
  const data = await res.json();
  const articles = (data.results ?? []).map((r: { title: string; link: string }) => ({
    title: r.title,
    link: r.link,
  }));
  return NextResponse.json(articles);
}
