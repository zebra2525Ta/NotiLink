"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotiLinkLogo from "@/app/components/NotiLinkLogo";
import type { ScheduleEvent } from "@/app/api/schedule/route";

const SHORTCUTS = [
  { label: "Notion", desc: "ノート・DB", scheme: "notion://", fallback: "https://notion.so", icon: "/notion.png" },
  { label: "カレンダー", desc: "予定・リマインダー", scheme: "notion://", fallback: "https://calendar.notion.so", icon: "/notioncare.webp" },
  { label: "SmartNews", desc: "最新ニュース", scheme: "smartnews://", fallback: "https://smartnews.com", icon: "/smartnews.png" },
  { label: "SBI証券", desc: "株・ポートフォリオ", scheme: "sbisec://", fallback: "https://www.sbisec.co.jp", icon: "/sbi.webp" },
];

function openApp(scheme: string, fallback: string) {
  window.location.href = scheme;
  setTimeout(() => { window.location.href = fallback; }, 1000);
}

function Sparkline({ positive }: { positive: boolean }) {
  const pts = positive ? "0,20 10,17 20,14 30,11 40,7 50,5" : "0,5 10,8 20,11 30,14 40,17 50,20";
  return (
    <svg width="50" height="24" viewBox="0 0 50 24" fill="none" style={{ flexShrink: 0 }}>
      <polyline points={pts} stroke={positive ? "#10b981" : "#f43f5e"} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

type ForecastSlot = { time: string; icon: string; temp: number };
type Weather = {
  condition: string; temp: number; tempMax: number; tempMin: number;
  feelsLike: number; humidity: number; pressure: number;
  windSpeed: number; rain: number | null;
  sunrise: string | null; sunset: string | null;
  icon: string; forecast?: ForecastSlot[];
};
type NewsItem = { title: string; link: string; source?: string };
type Stock = {
  code: string; name: string; close: number;
  change: string; changePercent: string; positive: boolean; date: string;
};

const S = {
  bg: "#0d0f14", surf: "#141720", surf2: "#1a1e2a",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.12)",
  text: "#e8eaf0", muted: "#6b7280",
  accent: "#6366f1", accent2: "#818cf8",
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: S.muted, textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </p>
  );
}

function ShortcutRow({ icon, label, desc, onClick }: { icon?: string; label: string; desc: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4, width: "100%", background: hover ? S.surf2 : "transparent", border: "none", color: S.text, transition: "background 0.15s", textAlign: "left" }}
    >
      <div style={{ width: 34, height: 34, background: S.surf2, borderRadius: 8, border: `0.5px solid ${S.border2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {icon
          ? <img src={icon} alt={label} style={{ width: 34, height: 34, objectFit: "cover" }} />
          : <span style={{ fontSize: 14, color: S.accent2 }}>✦</span>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: S.muted, marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  );
}

function formatEventTime(start: string, end: string | null): string {
  if (!start.includes("T")) return "終日";
  const s = start.split("T")[1].slice(0, 5);
  if (!end || !end.includes("T")) return s;
  return `${s}〜${end.split("T")[1].slice(0, 5)}`;
}

export default function Home() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [time, setTime] = useState("");
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/weather").then(r => r.json()).then(setWeather).catch(() => null);
    fetch("/api/news").then(r => r.json()).then(setNews).catch(() => []);
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => []);
    fetch("/api/schedule")
      .then(r => r.json())
      .then(data => { setSchedule(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));

    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setTime(`${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 今日〜5日後の日付リスト（JST）
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + (9 * 3600 + i * 86400) * 1000);
    return d.toISOString().split("T")[0];
  });

  const eventsByDay: Record<string, ScheduleEvent[]> = {};
  for (const day of days) eventsByDay[day] = [];
  for (const ev of schedule) {
    const day = ev.start.split("T")[0];
    if (eventsByDay[day]) eventsByDay[day].push(ev);
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: S.bg, color: S.text, fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: `0.5px solid ${S.border}`, background: S.surf }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
          </div>
          <NotiLinkLogo size={20} bg={S.surf} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.05em" }}>NotiLink</span>
          <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.15)", color: S.accent2, borderRadius: 20, border: `0.5px solid rgba(99,102,241,0.3)` }}>AI秘書</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: S.muted, fontVariantNumeric: "tabular-nums" }}>{time}</span>
          <div style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(16,185,129,0.2)" }} />
        </div>
      </header>

      {/* ── Dashboard Grid ── */}
      <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "220px 1fr 1fr", gridTemplateRows: "auto auto auto", gap: 1, background: S.border }}>

        {/* Col 1: Shortcuts (spans rows 1-2) */}
        <div style={{ gridColumn: 1, gridRow: "1 / 3", background: S.surf, padding: 16, borderRight: `1px solid ${S.border}` }}>
          <SectionLabel>ショートカット</SectionLabel>
          {SHORTCUTS.map(s => (
            <ShortcutRow key={s.label} icon={s.icon} label={s.label} desc={s.desc} onClick={() => openApp(s.scheme, s.fallback)} />
          ))}
          <div style={{ height: 0.5, background: S.border, margin: "12px 0" }} />
          <SectionLabel>クイックアクション</SectionLabel>
          <ShortcutRow label="AI秘書" desc="メモ登録・検索" onClick={() => router.push("/chat")} />
        </div>

        {/* Col 2: Weather */}
        <div style={{ gridColumn: 2, gridRow: 1, background: S.bg, padding: 16 }}>
          <SectionLabel>天気 — 大阪</SectionLabel>
          {weather ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06))", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                  {weather.icon}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{weather.temp}°</span>
                    <span style={{ fontSize: 12, color: S.muted }}>体感 {weather.feelsLike}°</span>
                  </div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{weather.condition}</div>
                  <div style={{ fontSize: 11, color: S.accent2, marginTop: 2 }}>大阪市 · 最高{weather.tempMax}° 最低{weather.tempMin}°</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 14 }}>
                {[
                  { icon: "💧", label: "湿度", value: `${weather.humidity}%` },
                  { icon: "🌬️", label: "風速", value: `${weather.windSpeed}m/s` },
                  { icon: "📊", label: "気圧", value: `${weather.pressure}hPa` },
                  ...(weather.rain != null ? [{ icon: "☔", label: "降水", value: `${weather.rain}mm/h` }] : []),
                  ...(weather.sunrise ? [{ icon: "🌅", label: "日の出", value: weather.sunrise }] : []),
                  ...(weather.sunset ? [{ icon: "🌇", label: "日の入", value: weather.sunset }] : []),
                ].map((stat, i) => (
                  <div key={i} style={{ padding: "6px 8px", background: S.surf, borderRadius: 8, border: `0.5px solid ${S.border}` }}>
                    <div style={{ fontSize: 10, color: S.muted, display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 11 }}>{stat.icon}</span>{stat.label}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: S.text, marginTop: 2 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {weather.forecast && (
                <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                  {weather.forecast.map((slot, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: S.surf, borderRadius: 6, border: `0.5px solid ${S.border}` }}>
                      <div style={{ fontSize: 10, color: S.muted }}>{slot.time}</div>
                      <div style={{ fontSize: 14, margin: "3px 0" }}>{slot.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{slot.temp}°</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
        </div>

        {/* Col 3: Stocks */}
        <div style={{ gridColumn: 3, gridRow: 1, background: S.bg, padding: 16 }}>
          <SectionLabel>注目銘柄</SectionLabel>
          {stocks.length > 0 ? stocks.map(s => (
            <div key={s.code} style={{ display: "flex", alignItems: "center", padding: "9px 10px", borderRadius: 8, marginBottom: 4, background: S.surf, border: `0.5px solid ${S.border}` }}>
              <div style={{ fontSize: 10, color: S.muted, minWidth: 36 }}>{s.code}</div>
              <Sparkline positive={s.positive} />
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1, marginLeft: 8 }}>{s.name}</div>
              <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.close.toLocaleString()}円</div>
              <div style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, marginLeft: 8, fontVariantNumeric: "tabular-nums", minWidth: 72, textAlign: "right", color: s.positive ? "#10b981" : "#f43f5e", background: s.positive ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)" }}>
                {s.positive ? "▲" : "▼"} {s.changePercent}%
              </div>
            </div>
          )) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
        </div>

        {/* Col 2-3: News */}
        <div style={{ gridColumn: "2 / 4", gridRow: 2, background: S.bg, padding: 16 }}>
          <SectionLabel>ニュース</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {news.length > 0 ? news.slice(0, 8).map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: S.surf, borderRadius: 8, border: `0.5px solid ${S.border}`, textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 500, color: S.border2, lineHeight: 1, flexShrink: 0, width: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p style={{ fontSize: 12, color: S.text, lineHeight: 1.5 }}>{n.title}</p>
                  {n.source && <p style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>{n.source}</p>}
                </div>
              </a>
            )) : <p style={{ fontSize: 13, color: S.muted, gridColumn: "1/3" }}>読み込み中...</p>}
          </div>
        </div>

        {/* Col 1-3: Schedule */}
        <div style={{ gridColumn: "1 / 4", gridRow: 3, background: S.surf, padding: "14px 20px", borderTop: `1px solid ${S.border2}` }}>
          <SectionLabel>スケジュール（直近7日）</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {days.map((day, i) => {
              const dow = new Date(day).getUTCDay();
              const label = i === 0 ? "今日" : i === 1 ? "明日" : `${DAY_LABELS[dow]}曜`;
              const dateLabel = day.slice(5).replace("-", "/");
              const evs = eventsByDay[day] ?? [];
              return (
                <div key={day}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: i === 0 ? S.accent2 : S.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 10, color: S.muted, marginBottom: 6 }}>{dateLabel}</div>
                  {scheduleLoading ? (
                    <div style={{ fontSize: 10, color: S.border2 }}>...</div>
                  ) : evs.length === 0 ? (
                    <div style={{ fontSize: 11, color: S.border2 }}>—</div>
                  ) : evs.map((ev, j) => (
                    <div key={j} style={{ marginBottom: 4, padding: "4px 6px", background: S.surf2, borderRadius: 5, borderLeft: `2px solid ${S.accent}` }}>
                      <div style={{ fontSize: 9, color: S.accent2, marginBottom: 1 }}>{formatEventTime(ev.start, ev.end)}</div>
                      <div style={{ fontSize: 11, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
