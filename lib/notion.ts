import { Client } from "@notionhq/client";
import type { GroqResult } from "./groq";
import gamesConfig from "@/config/games.json";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DB_IDS = {
  misc: process.env.NOTION_DB_MISC!,
  places: process.env.NOTION_DB_PLACES!,
  shopping: process.env.NOTION_DB_SHOPPING!,
  schedule: process.env.NOTION_DB_SCHEDULE!,
};

export async function saveToNotion(result: GroqResult): Promise<void> {
  switch (result.db) {
    case "misc":
      await notion.pages.create({
        parent: { database_id: DB_IDS.misc },
        properties: {
          テキスト: {
            title: [{ text: { content: result.data.text ?? "" } }],
          },
        },
      });
      break;

    case "game": {
      const gameName = result.gameName ?? "";
      const gameDbId = (gamesConfig.games as Record<string, string>)[gameName];
      if (!gameDbId || gameDbId === "notion_db_id_をここに入れる") {
        throw new Error(`ゲーム「${gameName}」のDBが設定されていません`);
      }
      await notion.pages.create({
        parent: { database_id: gameDbId },
        properties: {
          タイトル: {
            title: [{ text: { content: result.data.title ?? "" } }],
          },
          メモ: {
            rich_text: [{ text: { content: result.data.memo ?? "" } }],
          },
        },
      });
      break;
    }

    case "places":
      await notion.pages.create({
        parent: { database_id: DB_IDS.places },
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
        parent: { database_id: DB_IDS.shopping },
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
        parent: { database_id: DB_IDS.schedule },
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
