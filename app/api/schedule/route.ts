import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchDatabases } from "@/lib/notion";

export type ScheduleEvent = {
  title: string;
  start: string;
  end: string | null;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json([], { status: 401 });
    }

    const schemas = await searchDatabases(session.accessToken);
    const scheduleDb = schemas.find(s =>
      /スケジュール|schedule|カレンダー|calendar/i.test(s.title)
    );
    if (!scheduleDb) return NextResponse.json([]);

    const dateProp = scheduleDb.properties.find(p => p.type === "date");
    if (!dateProp) return NextResponse.json([]);

    // JST 今日〜5日後
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split("T")[0];
    const plus5Str = new Date(jstNow.getTime() + 5 * 86400 * 1000)
      .toISOString().split("T")[0];

    const res = await fetch(`https://api.notion.com/v1/databases/${scheduleDb.id}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: dateProp.name, date: { on_or_after: todayStr } },
            { property: dateProp.name, date: { on_or_before: plus5Str } },
          ],
        },
        sorts: [{ property: dateProp.name, direction: "ascending" }],
        page_size: 100,
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any;
    if (!Array.isArray(data.results)) return NextResponse.json([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: ScheduleEvent[] = data.results.map((page: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = page.properties as Record<string, any>;
      const titleEntry = Object.values(props).find(p => p.type === "title");
      const dateEntry = Object.values(props).find(p => p.type === "date");
      return {
        title: titleEntry?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "無題",
        start: dateEntry?.date?.start ?? "",
        end: dateEntry?.date?.end ?? null,
      };
    }).filter((e: ScheduleEvent) => e.start);

    return NextResponse.json(events);
  } catch (e) {
    console.error("[schedule]", e);
    return NextResponse.json([]);
  }
}
