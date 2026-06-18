import Groq from "groq-sdk";
import type { DbSchema } from "./notion";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type Mode = "normal" | "business" | "friend";

export function buildNotificationPrompt(params: {
  jstDate: string;
  jstTime: string;
  scheduleSummary: string;
  shoppingSummary: string;
  weatherSummary: string;
  theme: string;
  historyText: string;
}): string {
  const { jstDate, jstTime, scheduleSummary, shoppingSummary, weatherSummary, theme, historyText } = params;
  return `あなたは「Navi」という名前の、ユーザーのことを本当に心配している幼なじみのような存在です。
事務的・ロボット的な言い方は絶対にしないこと。
まるで近くにいる友達が「ねえ、大丈夫？」と声をかけてくれるような、温かくて自然な口調で書いてください。
絵文字は使わないこと。！を自然に使うこと。

【今日の日付】${jstDate}
【現在時刻】${jstTime}
【今日のスケジュール】${scheduleSummary}
【買い物リスト（未購入）】${shoppingSummary}
【天気】${weatherSummary}
${historyText}

【今回のテーマ】${theme}

ルール:
- 上記テーマの情報を必ずメインに使うこと（「なし」の場合のみ他の情報で代替）
- スケジュール・買い物・天気の内容をそのままtitle/bodyに書き写さないこと。あくまで参考にして、Naviの言葉で語りかけること
- titleは通知バナーの見出し（20文字以内・興味を引く一言）
- bodyは本文（50文字以内・具体的な情報＋一言気遣い）
- messageはNaviからの追加メッセージ（200文字程度・くだけた友達トーンで心配・励まし・応援を2〜3文で。情報を添えながら気持ちを伝えること）
- 例: "ねえ、今日の夕方から雨らしいよ！傘持った？朝は晴れてるから忘れがちだけど、帰り道びしょ濡れになってほしくないから言っとく！気をつけてね"
- 例: "牛乳まだ買えてないんじゃないかと思って！帰り道にスーパー寄れそうだったら買ってきてね。買い物リストにまだ残ってるから、ちゃんと確認してね！"
- JSONのみ・前置き不要

{"title":"...","body":"...","message":"...","url":"/"}`;
}

const MODE_PROMPTS: Record<Mode, string> = {
  normal: "",
  business: "返答は丁寧でフォーマルなビジネス敬語にすること。",
  friend: "返答はタメ口で、友達のようにちょっとおせっかいなくらい心配したり励ましたりすること。絵文字は絶対に使わないこと。！を多めに使うこと。",
};

export interface IntentResult {
  intent: "register" | "query" | "update_purchased" | "answer";
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

  const systemPrompt = `あなたはNotionを管理するNaviです。ユーザーの入力を以下の4種類に分類し、JSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

【今日の日付・時刻】
${buildDateContext()}

利用可能なデータベース:
[
${dbList}
]

【日時質問の場合】今日・明日・何曜日・何日・何時など日付や時刻を聞かれたとき（DBは不要）
{"intent":"answer","database_id":"","message":"日付や時刻を日本語で答える（例:今日は2026年6月16日（月曜日）です）","confidence":100}

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

【スケジュール系DBを選ぶとき】
- 日付・曜日・時刻 + 予定・イベントが含まれるとき（例:「明日3時病院」「土曜映画」「来週月曜バイト」）
- YYYY-MM-DD形式の日付が含まれるとき

【買い物リスト系DBを選ぶとき】
- 商品名・食材名・日用品などの単体名詞のみの入力（例:「牛乳」「洗剤」「長いも」）
- 「〜買う」「〜欲しい」「〜必要」などの購買意図があるとき

【行きたいとこ・場所系DBを選ぶとき】
- 場所名 + 「行きたい」「気になる」「訪れたい」「おすすめ」（例:「大阪のカフェ行きたい」「京都行ってみたい」）

【未分類・メモ系DBを選ぶとき（デフォルト）】
- 感想・体験・気づき・アイデア・日記的な内容（例:「長芋すって醤油かけたらうまい」「今日疲れた」）
- 上記のどのDBにも明確に当てはまらないとき
- 迷ったら必ず未分類を選ぶこと（confidence < 60）
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

  const systemPrompt = `あなたはNotionデータベースへのデータ登録を行うNaviです。ユーザーの入力をNotionのプロパティに変換し、JSONのみを返してください。前置き・説明文・コードブロックは一切含めないこと。

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
        content: `あなたはNaviです。Notionデータベース「${dbTitle}」の内容をもとに、ユーザーの質問に日本語で簡潔に答えてください。${modeHint}\n\n【今日の日付】\n${buildDateContext()}`,
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
