import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Client } from "@notionhq/client";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "no token" }, { status: 401 });
  }

  const notion = new Client({ auth: session.accessToken });

  const response = await notion.search({ page_size: 10 });

  return NextResponse.json({
    total: response.results.length,
    has_more: response.has_more,
    types: response.results.map(r => ({ object: r.object, id: r.id })),
  });
}
