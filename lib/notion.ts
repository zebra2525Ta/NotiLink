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

async function findChildDatabases(accessToken: string, pageId: string, seen: Set<string>, depth = 0): Promise<DbSchema[]> {
  if (depth > 2) return [];
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Notion-Version": "2022-06-28" },
  });
  if (!res.ok) {
    console.log("[notion] blocks failed:", pageId, res.status);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  const schemas: DbSchema[] = [];

  for (const block of data.results ?? []) {
    if (block.type === "child_database" && !seen.has(block.id)) {
      seen.add(block.id);
      const schema = await fetchDbSchema(accessToken, block.id);
      if (schema) schemas.push(schema);
    }
    if (block.type === "child_page" && !seen.has(block.id)) {
      seen.add(block.id);
      const nested = await findChildDatabases(accessToken, block.id, seen, depth + 1);
      schemas.push(...nested);
    }
  }
  return schemas;
}

async function fetchDbSchema(accessToken: string, id: string): Promise<DbSchema | null> {
  try {
    const notion = new Client({ auth: accessToken });
    const db = await notion.databases.retrieve({ database_id: id }) as unknown as {
      title: Array<{ plain_text: string }>;
      properties: Record<string, { type: string }>;
    };
    const title = db.title?.[0]?.plain_text ?? "無題";
    const properties = Object.entries(db.properties ?? {}).map(([name, prop]) => ({
      name,
      type: prop.type,
    }));
    return { id, title, properties };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.log("[notion] fetchDb failed:", id, msg);
    return null;
  }
}

export async function searchDatabases(accessToken: string): Promise<DbSchema[]> {
  const allDatabases: DbSchema[] = [];
  const seenIds = new Set<string>();

  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  if (!Array.isArray(data.results)) {
    console.error("[notion] search failed:", JSON.stringify(data));
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log("[notion] all results:", data.results.map((r: any) => ({
    id: r.id,
    object: r.object,
    parent: r.parent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    title: (r.title as any[])?.[0]?.plain_text ?? (r.properties?.title?.title as any[])?.[0]?.plain_text ?? "?",
  })));

  const dbIdsToTry = new Set<string>();
  const pageIdsToTraverse = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const result of data.results as any[]) {
    const id: string = result.id;
    const object: string = result.object;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent: any = result.parent;

    if (object === "database") {
      dbIdsToTry.add(id);
      // Also traverse parent page (inline DBs have parent.type === "page_id")
      if (parent?.type === "page_id") pageIdsToTraverse.add(parent.page_id);
      // Linked DB view has parent.type === "database_id" pointing to the real DB
      if (parent?.type === "database_id") dbIdsToTry.add(parent.database_id);
    } else if (object === "page") {
      if (parent?.type === "database_id") {
        // This page is an item inside a database — get that database
        dbIdsToTry.add(parent.database_id);
      } else {
        // Top-level or page-nested page — traverse its children for inline DBs
        pageIdsToTraverse.add(id);
        // Also traverse parent page if nested
        if (parent?.type === "page_id") pageIdsToTraverse.add(parent.page_id);
      }
    }
  }

  // Fetch schemas for all discovered database IDs
  for (const dbId of dbIdsToTry) {
    if (seenIds.has(dbId)) continue;
    seenIds.add(dbId);
    const schema = await fetchDbSchema(accessToken, dbId);
    if (schema) allDatabases.push(schema);
  }

  // Traverse pages to find child_database blocks
  for (const pageId of pageIdsToTraverse) {
    if (seenIds.has(`page:${pageId}`)) continue;
    seenIds.add(`page:${pageId}`);
    const nested = await findChildDatabases(accessToken, pageId, seenIds);
    allDatabases.push(...nested);
  }

  console.log("[notion] found databases:", allDatabases.map(d => ({ id: d.id, title: d.title })));
  return allDatabases;
}

export async function queryDatabase(accessToken: string, databaseId: string): Promise<Record<string, string>[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 50 }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await res.json() as any;

  if (!Array.isArray(response.results)) {
    console.error("[notion] query unexpected response:", JSON.stringify(response));
    return [];
  }

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

    console.log("[notion] save: schema props:", JSON.stringify(schema.properties), "item props:", JSON.stringify(item.properties));

    const unmatchedValues: string[] = [];

    for (const [name, value] of Object.entries(item.properties)) {
      const prop = propTypeMap.get(name.trim().toLowerCase());
      if (!prop) {
        console.log("[notion] save: no match for prop:", name, "available:", [...propTypeMap.keys()]);
        if (value) unmatchedValues.push(value);
        continue;
      }
      const formatted = formatProperty(value, prop.type);
      if (formatted) notionProperties[prop.name] = formatted;
    }

    // Fallback 1: if title property not yet set, use first unmatched value
    const titleProp = schema.properties.find((p) => p.type === "title");
    if (titleProp && !notionProperties[titleProp.name]) {
      const fallback = unmatchedValues[0] ?? Object.values(item.properties).find(Boolean) ?? "";
      if (fallback) {
        notionProperties[titleProp.name] = { title: [{ text: { content: fallback } }] };
      }
    }

    // Fallback 2: if still nothing mapped, dump all unmatched string values into title
    if (Object.keys(notionProperties).length === 0 && titleProp) {
      const allValues = Object.values(item.properties).filter(Boolean).join(" ");
      if (allValues) {
        notionProperties[titleProp.name] = { title: [{ text: { content: allValues } }] };
      }
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
