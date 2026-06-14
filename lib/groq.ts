import Groq from "groq-sdk";
import type { DbSchema } from "./notion";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type Mode = "normal" | "business" | "friend";

const MODE_PROMPTS: Record<Mode, string> = {
  normal: "",
  business: "返答は丁寧でフォーマルなビジネス敬語にすること。",
  friend: "返答はフランクで親しみやすいタメ口にすること。絵文字を1つ使ってよい。",
};

export interface IntentResult {
  intent: "register" | "query" | "update_purchased";
  database_id: string;
  message: string | null;
  search_title?: string; // update_purchased時: 検索するアイテム名
  content?: string;      // register時: 指示ワードを除いた純粋な登録内容
  confidence: number;    // DB分類の確信度 0〜100
}

// ── Phase 1: どのDBか・登録か検索かを判断 ──────────────────────────────
export async function detectIntent(
  text: string,
  schemas: DbSchema[],
  mode: Mode = "normal"
): Promise<IntentResult> {
  const dbList = schemas
    .map((s) => `  {"database_id":"${s.id}","db_title":"${s.title}"}`)
    .join(",\n");

  const modeHint = MODE_PROMPTS[mode];

  const systemPrompt = `あなたはNotionを管理するAI秘書です。ユーザーの入力を以下の3種類に分類し、JSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

利用可能なデータベース:
[
${dbList}
]

【登録の場合】新しいデータを追加する（「〜買う」「〜予定」「〜行きたい」など）
{"intent":"register","database_id":"最も適切なdatabase_idをそのままコピー","message":"秘書の一言（30文字以内）","content":"登録する内容のみ（「〜して」「〜登録」「〜メモ」などの指示表現を除いた純粋なコンテンツ）","confidence":85}

【購入済み更新の場合】既存アイテムを買った・購入した・チェックしたいとき（「〜買った」「〜購入した」「〜ゲットした」など）
{"intent":"update_purchased","database_id":"買い物リストのdatabase_id","search_title":"アイテム名のみ","message":"秘書の一言（30文字以内）","confidence":90}

【検索・質問の場合】データベースの内容を知りたいとき（「〜教えて」「〜一覧」「〜は？」など）
{"intent":"query","database_id":"最も関連するdatabase_idをそのままコピー","message":null,"confidence":80}

ルール:
- database_idは上記リストの値を1文字も変えずコピー
- messageは日本語
- search_titleはアイテム名のみ（「柔軟剤を買った」→「柔軟剤」）
- confidenceはDB選択の確信度（0〜100の整数）。どのDBか明確なら80以上、曖昧なら60未満にすること
- YYYY-MM-DD形式の日付や時刻が含まれる場合はスケジュール・予定・カレンダー系のDBを優先すること
- 「〜買う」「〜欲しい」「〜必要」などの購買意図、または文章でない単体の商品名・食材名・日用品名のみの入力は買い物リスト系のDBを選ぶこと（例：「長いも」「牛乳」「洗剤」→買い物リスト）
- 感想・体験・気づき・料理メモなど述語を含む文章（「〜うまい」「〜楽しかった」「〜だった」「〜してみた」など）はスケジュール・買い物・場所系以外のメモ・日記・未分類系DBを選ぶこと（例：「長芋すって醤油かけたらうまい」→メモ系）
- 場所名 + 「行きたい」「気になる」「訪れたい」はお出かけ・場所系DBを選ぶこと
${modeHint ? `- ${modeHint}` : ""}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as IntentResult;
}

function buildDateContext(): string {
  const DAY_NAME = ["日", "月", "火", "水", "木", "金", "土"];
  const DAY_LABEL = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
  // JST = UTC+9
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const toStr = (d: Date) => d.toISOString().split("T")[0];
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  const todayDow = jstNow.getUTCDay(); // 0=日,1=月,...,6=土

  // 月曜始まりの週で「今週」「来週」「再来週」を定義
  // 今週の月曜 = 今日 - (todayDow === 0 ? 6 : todayDow - 1)
  const daysFromMon = todayDow === 0 ? 6 : todayDow - 1;
  const thisMonday = addDays(jstNow, -daysFromMon);

  const lines: string[] = [
    `【今日】 ${toStr(jstNow)}（${DAY_NAME[todayDow]}曜日）`,
    `【明日】 ${toStr(addDays(jstNow, 1))}（${DAY_LABEL[(todayDow + 1) % 7]}）`,
    "",
    "【今週 月〜日】",
  ];
  for (let i = 0; i < 7; i++) {
    const d = addDays(thisMonday, i);
    lines.push(`  今週${DAY_LABEL[i === 6 ? 0 : i + 1 === 7 ? 0 : (i + 1)]}: `);
  }
  // 今週
  for (let i = 0; i < 7; i++) {
    const d = addDays(thisMonday, i);
    const dow = d.getUTCDay();
    lines[lines.length - 7 + i] = `  今週${DAY_LABEL[dow]}: ${toStr(d)}`;
  }

  lines.push("", "【来週 月〜日】");
  const nextMonday = addDays(thisMonday, 7);
  for (let i = 0; i < 7; i++) {
    const d = addDays(nextMonday, i);
    const dow = d.getUTCDay();
    lines.push(`  来週${DAY_LABEL[dow]}: ${toStr(d)}`);
  }

  lines.push("", "【再来週 月〜日】");
  const weekAfter = addDays(thisMonday, 14);
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekAfter, i);
    const dow = d.getUTCDay();
    lines.push(`  再来週${DAY_LABEL[dow]}: ${toStr(d)}`);
  }

  return lines.join("\n");
}

// ── Phase 2: 既存データを真似してプロパティを生成（複数日対応） ──────────
export async function generateProperties(
  text: string,
  schema: DbSchema,
  examples: Record<string, string>[],
  mode: Mode = "normal"
): Promise<Record<string, string>[]> {
  const propDefs = schema.properties
    .map((p) => `- ${p.name} (${p.type}型)`)
    .join("\n");

  const examplesText =
    examples.length === 0
      ? "（既存データなし）"
      : examples
          .slice(0, 3)
          .map((row, i) => `例${i + 1}: ${JSON.stringify(row, null, 0)}`)
          .join("\n");

  const modeHint = MODE_PROMPTS[mode];

  const systemPrompt = `あなたはNotionデータベースへのデータ登録を行うAI秘書です。ユーザーの入力をNotionのプロパティに変換し、JSONのみを返してください。前置き・説明文・コードブロックは一切含めないこと。

データベース名: ${schema.title}

プロパティ定義:
${propDefs}

既存データの例（キー名・値の形式をそのまま真似すること）:
${examplesText}

【日付カレンダー】（必ずこの表を参照して正確な日付を使うこと）
${buildDateContext()}

ルール:
- キー名は上記プロパティ定義の名前を1文字も変えずコピー（英語・ローマ字変換・翻訳禁止）
- title型: イベント名・物品名など「内容のみ」。日付・時刻は絶対含めない（例: "6/19バイト"→"バイト"）
- date型: 必ず "開始~終了" のチルダ区切りで返す。時刻はJST（日本時間）で24時間表記、必ず+09:00を付ける
  ・日付のみ → "YYYY-MM-DDT00:00:00+09:00~YYYY-MM-DDT23:58:00+09:00"
  ・日付+開始時間 → "YYYY-MM-DDTHH:MM:00+09:00~YYYY-MM-DDT23:58:00+09:00"
  ・日付+開始〜終了時間 → "YYYY-MM-DDTHH:MM:00+09:00~YYYY-MM-DDTHH:MM:00+09:00"
- 入力テキストに "YYYY-MM-DD" 形式の日付が明示されている場合は日付カレンダーを無視してその値をそのまま使うこと
- 「作成日時」「更新日時」「作成者」などシステム管理系プロパティには値を設定しないこと。イベント日付はスケジュール・日付・日時などのプロパティに入れること
- rich_text型: 補足・メモ
- checkbox型: "true" または "false"
- title型は必ず含める
${modeHint ? `- ${modeHint}` : ""}

【複数日・複数件の場合】
複数の日付・曜日が指定された場合は、itemsに複数のオブジェクトを入れること。
{"items":[{"プロパティ名":"値",...},{"プロパティ名":"値",...}]}

【1件の場合】
{"items":[{"プロパティ名":"値",...}]}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? '{"items":[]}';
  console.log("[groq] generateProperties raw:", content);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(content) as any;

  // {"items":[...]} 形式
  if (Array.isArray(parsed.items)) return parsed.items as Record<string, string>[];
  // フォールバック: オブジェクト直返しや配列直返し
  if (Array.isArray(parsed)) return parsed as Record<string, string>[];
  return [parsed] as Record<string, string>[];
}

// ── クエリ結果を自然言語で返す ────────────────────────────────────────
export async function generateQueryResponse(
  question: string,
  dbTitle: string,
  pages: Record<string, string>[],
  mode: Mode = "normal"
): Promise<string> {
  const modeHint = MODE_PROMPTS[mode];
  const pagesText =
    pages.length === 0
      ? "（データなし）"
      : pages.map((p, i) => {
          const { __page_id: _id, __body, ...props } = p;
          const propStr = Object.entries(props)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" / ");
          const bodyStr = __body ? `\n   【本文】${__body}` : "";
          return `${i + 1}. ${propStr}${bodyStr}`;
        }).join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたはAI秘書です。Notionデータベース「${dbTitle}」の内容をもとに、ユーザーの質問に日本語で簡潔に答えてください。${modeHint}`,
      },
      {
        role: "user",
        content: `質問: ${question}\n\nデータベースの内容:\n${pagesText}`,
      },
    ],
    temperature: 0.3,
  });

  return completion.choices[0].message.content ?? "データを取得できませんでした。";
}
