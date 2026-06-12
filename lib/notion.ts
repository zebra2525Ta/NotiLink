import { Client } from "@notionhq/client";
import type { GroqItem, GroqResult } from "./groq";
import type { UserDbIds } from "./redis";

async function saveItem(notion: Client, item: GroqItem, dbIds: UserDbIds): Promise<void> {
  switch (item.db) {
    case "misc":
      await notion.pages.create({
        parent: { database_id: dbIds.misc },
        properties: {
          テキスト: {
            title: [{ text: { content: item.data.text ?? "" } }],
          },
        },
      });
      break;

    case "places":
      await notion.pages.create({
        parent: { database_id: dbIds.places },
        properties: {
          場所名: {
            title: [{ text: { content: item.data.placeName ?? "" } }],
          },
          エリア: {
            rich_text: [{ text: { content: item.data.area ?? "" } }],
          },
          メモ: {
            rich_text: [{ text: { content: item.data.memo ?? "" } }],
          },
          行った: { checkbox: false },
        },
      });
      break;

    case "shopping":
      await notion.pages.create({
        parent: { database_id: dbIds.shopping },
        properties: {
          商品名: {
            title: [{ text: { content: item.data.itemName ?? "" } }],
          },
          数量: {
            rich_text: [{ text: { content: item.data.quantity ?? "" } }],
          },
          購入済み: { checkbox: false },
        },
      });
      break;

    case "schedule": {
      const dateStr = item.data.date;
      const timeStr = item.data.time;
      const dateStart = dateStr
        ? timeStr
          ? `${dateStr}T${timeStr}:00`
          : dateStr
        : null;

      await notion.pages.create({
        parent: { database_id: dbIds.schedule },
        properties: {
          タイトル: {
            title: [{ text: { content: item.data.title ?? "" } }],
          },
          ...(dateStart ? { 日付: { date: { start: dateStart } } } : {}),
          メモ: {
            rich_text: [{ text: { content: item.data.memo ?? "" } }],
          },
        },
      });
      break;
    }
  }
}

export async function saveToNotion(result: GroqResult, accessToken: string, dbIds: UserDbIds): Promise<void> {
  const notion = new Client({ auth: accessToken });
  for (const item of result.items) {
    await saveItem(notion, item, dbIds);
  }
}
