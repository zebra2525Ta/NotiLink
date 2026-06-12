import { NextResponse } from "next/server";

export async function GET() {
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
