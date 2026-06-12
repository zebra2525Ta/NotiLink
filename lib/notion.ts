import { Client } from "@notionhq/client";
import type { GroqResult } from "./groq";
import type { UserDbIds } from "./redis";

export async function saveToNotion(result: GroqResult, accessToken: string, dbIds: UserDbIds): Promise<void> {
  const notion = new Client({ auth: accessToken });

  switch (result.db) {
    case "misc":
      await notion.pages.create({
        parent: { database_id: dbIds.misc },
        properties: {
          テキスト: {
            title: [{ text: { content: result.data.text ?? "" } }],
          },
        },
      });
      break;

    case "places":
      await notion.pages.create({
        parent: { database_id: dbIds.places },
        properties: {
          場所名: {
            title: [{ text: { content: result.data.placeName ?? "" } }],
          },
          エリア: {
            rich_text: [{ text: { content: result.data.area ?? "" } }],
          },
          メモ: {
            rich_text: [{ text: { content: result.data.memo ?? "" } }],
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
            title: [{ text: { content: result.data.itemName ?? "" } }],
          },
          数量: {
            rich_text: [{ text: { content: result.data.quantity ?? "" } }],
          },
          購入済み: { checkbox: false },
        },
      });
      break;

    case "schedule": {
      const dateStr = result.data.date;
      const timeStr = result.data.time;
      const dateStart = dateStr
        ? timeStr
          ? `${dateStr}T${timeStr}:00`
          : dateStr
        : null;

      await notion.pages.create({
        parent: { database_id: dbIds.schedule },
        properties: {
          タイトル: {
            title: [{ text: { content: result.data.title ?? "" } }],
          },
          ...(dateStart ? { 日付: { date: { start: dateStart } } } : {}),
          メモ: {
            rich_text: [{ text: { content: result.data.memo ?? "" } }],
          },
        },
      });
      break;
    }
  }
}
