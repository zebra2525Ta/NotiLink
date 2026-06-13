import { Client } from "@notionhq/client";

interface NotionDbRaw {
  id: string;
  object: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, { type: string }>;
}

export interface DbSchema {
  id: string;
  title: string;
  properties: { name: string; type: string }[];
}

export async function searchDatabases(accessToken: string): Promise<DbSchema[]> {
  const notion = new Client({ auth: accessToken });
  const allDatabases: DbSchema[] = [];
  let cursor: string | undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (notion.search as any)({
      filter: { property: "object", value: "data_source" },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }) as { results: NotionDbRaw[]; has_more: boolean; next_cursor: string | null };

    for (const result of response.results) {
      const title = result.title?.[0]?.plain_text ?? "無題";
      const properties = Object.entries(result.properties).map(([name, prop]) => ({
        name,
        type: prop.type,
      }));
      allDatabases.push({ id: result.id, title, properties });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return allDatabases;
}

export async function queryDatabase(accessToken: string, databaseId: string): Promise<Record<string, string>[]> {
  const notion = new Client({ auth: accessToken });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (notion.databases as any).query({ database_id: databaseId, page_size: 50 }) as any;

  return response.results.map((page: any) => {
    const row: Record<string, string> = {};
    for (const [key, prop] of Object.entries(page.properties as Record<string, any>)) {
      switch (prop.type) {
        case "title":
          row[key] = prop.title?.map((t: any) => t.plain_text).join("") ?? "";
          break;
        case "rich_text":
          row[key] = prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
          break;
        case "checkbox":
          row[key] = prop.checkbox ? "✓" : "✗";
          break;
        case "date":
          row[key] = prop.date?.start ?? "";
          break;
        case "select":
          row[key] = prop.select?.name ?? "";
          break;
        case "number":
          row[key] = prop.number != null ? String(prop.number) : "";
          break;
        default:
          break;
      }
    }
    return row;
  });
}

function formatProperty(value: string, type: string): Record<string, unknown> | null {
  if (value === "" || value === undefined) return null;
  switch (type) {
    case "title":
      return { title: [{ text: { content: value } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: value } }] };
    case "checkbox":
      return { checkbox: value === "true" };
    case "date":
      return { date: { start: value } };
    case "select":
      return { select: { name: value } };
    case "number":
      return { number: Number(value) };
    default:
      return { rich_text: [{ text: { content: value } }] };
  }
}

export async function saveToNotion(
  items: { database_id: string; properties: Record<string, string> }[],
  accessToken: string,
  schemas: DbSchema[]
): Promise<void> {
  const notion = new Client({ auth: accessToken });
  const schemaMap = new Map(schemas.map((s) => [s.id, s]));

  for (const item of items) {
    const schema = schemaMap.get(item.database_id);
    if (!schema) continue;

    // Build a normalized map: trimmed lowercase → {actualName, type}
    const propTypeMap = new Map(
      schema.properties.map((p) => [p.name.trim().toLowerCase(), { name: p.name, type: p.type }])
    );
    const notionProperties: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(item.properties)) {
      const prop = propTypeMap.get(name.trim().toLowerCase());
      if (!prop) continue;
      const formatted = formatProperty(value, prop.type);
      if (formatted) notionProperties[prop.name] = formatted;
    }

    // Notion requires at least one title property — add it if Groq omitted it
    const titleProp = schema.properties.find((p) => p.type === "title");
    if (titleProp && !notionProperties[titleProp.name]) {
      const fallback = Object.values(item.properties).find(Boolean) ?? "";
      notionProperties[titleProp.name] = { title: [{ text: { content: fallback } }] };
    }

    console.log("[notion] creating page in DB:", schema.title, JSON.stringify(notionProperties));

    try {
      await notion.pages.create({
        parent: { database_id: item.database_id },
        properties: notionProperties as Parameters<typeof notion.pages.create>[0]["properties"],
      });
    } catch (err) {
      console.error("[notion] pages.create failed:", JSON.stringify(err));
      throw err;
    }
  }
}
