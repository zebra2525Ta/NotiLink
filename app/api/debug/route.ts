import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Client } from "@notionhq/client";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "no token" }, { status: 401 });
  }

  const notion = new Client({ auth: session.accessToken });

  // フィルターなし
  const noFilter = await notion.search({ page_size: 10 });

  // data_source フィルター
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withFilter = await (notion.search as any)({
    filter: { property: "object", value: "data_source" },
    page_size: 10,
  });

  return NextResponse.json({
    noFilter: {
      total: noFilter.results.length,
      types: noFilter.results.map((r) => ({ object: r.object, id: r.id })),
    },
    withDataSource: {
      total: (withFilter as { results: { object: string; id: string }[] }).results.length,
      types: (withFilter as { results: { object: string; id: string }[] }).results.map((r) => ({
        object: r.object,
        id: r.id,
      })),
    },
  });
}
