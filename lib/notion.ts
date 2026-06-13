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
    const response = await notion.search({
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }) as unknown as { results: NotionDbRaw[]; has_more: boolean; next_cursor: string | null };

    for (const result of response.results) {
      if (result.object !== "database") continue;
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

    const propTypeMap = new Map(schema.properties.map((p) => [p.name, p.type]));
    const notionProperties: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(item.properties)) {
      const type = propTypeMap.get(name);
      if (!type) continue;
      const formatted = formatProperty(value, type);
      if (formatted) notionProperties[name] = formatted;
    }

    await notion.pages.create({
      parent: { database_id: item.database_id },
      properties: notionProperties as Parameters<typeof notion.pages.create>[0]["properties"],
    });
  }
}
