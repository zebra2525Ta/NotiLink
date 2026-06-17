"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Droplets, Wind, Gauge, Umbrella, Sunrise, Sunset } from "lucide-react";
import NotiLinkLogo from "@/app/components/NotiLinkLogo";
import type { ScheduleEvent } from "@/app/api/schedule/route";

const SHORTCUTS = [
  { label: "Notion", desc: "ノート・DB", scheme: "notion://", fallback: "https://notion.so", icon: "/notion.png" },
  { label: "カレンダー", desc: "予定・リマインダー", scheme: "https://calendar.notion.so", fallback: "https://calendar.notion.so", icon: "/notioncare.webp" },
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
  text: "#e8eaf0", muted: "#9ca3af",
  accent: "#6366f1", accent2: "#818cf8",
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: S.muted, textTransform: "uppercase", marginBottom: 10 }}>
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
        <div style={{ fontSize: 15, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: S.muted, marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  );
}

// モバイル用ショートカットグリッドボタン
function ShortcutTile({ icon, label, onClick }: { icon?: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", borderRadius: 10, cursor: "pointer", background: S.surf, border: `0.5px solid ${S.border2}`, color: S.text, width: "100%" }}
    >
      <div style={{ width: 32, height: 32, background: S.surf2, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {icon
          ? <img src={icon} alt={label} style={{ width: 32, height: 32, objectFit: "cover" }} />
          : <span style={{ fontSize: 14, color: S.accent2 }}>✦</span>}
      </div>
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
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
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/weather").then(r => r.json()).then(setWeather).catch(() => null);
    fetch("/api/news").then(r => r.json()).then(setNews).catch(() => []);
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => []);
    fetch("/api/schedule")
      .then(r => r.json())
      .then(data => { setSchedule(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));

  }, []);

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

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: S.bg, color: S.text, fontFamily: "var(--font-mplus), system-ui, sans-serif", paddingBottom: 24 }}>

        {/* ── Topbar ── */}
        <header style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: `0.5px solid ${S.border}`, background: S.surf }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotiLinkLogo size={18} bg={S.surf} />
            <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.05em" }}>NotiLink</span>
            <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(99,102,241,0.15)", color: S.accent2, borderRadius: 20, border: `0.5px solid rgba(99,102,241,0.3)` }}>Navi</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%" }} />
          </div>
        </header>

        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── 天気 ── */}
          <section style={{ background: S.surf, borderRadius: 14, padding: 16, border: `0.5px solid ${S.border}` }}>
            <SectionLabel>天気 — 大阪</SectionLabel>
            {weather ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06))", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    <img src={weather.icon} alt={weather.condition} style={{ width: 56, height: 56 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 40, fontWeight: 500, lineHeight: 1 }}>{weather.temp}°</span>
                      <span style={{ fontSize: 13, color: S.muted }}>体感 {weather.feelsLike}°</span>
                    </div>
                    <div style={{ fontSize: 13, color: S.muted }}>{weather.condition}</div>
                    <div style={{ fontSize: 12, color: S.accent2, marginTop: 2 }}>最高{weather.tempMax}° / 最低{weather.tempMin}°</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 12 }}>
                  {[
                    { icon: <Droplets size={11} color="#60a5fa" />, label: "湿度", value: `${weather.humidity}%` },
                    { icon: <Wind size={11} color="#94a3b8" />, label: "風速", value: `${weather.windSpeed}m/s` },
                    { icon: <Gauge size={11} color="#a78bfa" />, label: "気圧", value: `${weather.pressure}hPa` },
                    ...(weather.rain != null ? [{ icon: <Umbrella size={11} color="#818cf8" />, label: "降水", value: `${weather.rain}mm/h` }] : []),
                    ...(weather.sunrise ? [{ icon: <Sunrise size={11} color="#fb923c" />, label: "日の出", value: weather.sunrise }] : []),
                    ...(weather.sunset ? [{ icon: <Sunset size={11} color="#f97316" />, label: "日の入", value: weather.sunset }] : []),
                  ].map((stat, i) => (
                    <div key={i} style={{ padding: "6px 8px", background: S.bg, borderRadius: 8, border: `0.5px solid ${S.border}` }}>
                      <div style={{ fontSize: 10, color: S.muted, display: "flex", alignItems: "center", gap: 3 }}>{stat.icon}{stat.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {weather.forecast && (
                  <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto" }}>
                    {weather.forecast.map((slot, i) => (
                      <div key={i} style={{ flex: "0 0 auto", minWidth: 60, textAlign: "center", padding: "6px 6px", background: S.bg, borderRadius: 8, border: `0.5px solid ${S.border}` }}>
                        <div style={{ fontSize: 11, color: S.muted }}>{slot.time}</div>
                        <img src={slot.icon} alt="" style={{ width: 36, height: 36, margin: "0 auto", display: "block" }} />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{slot.temp}°</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
          </section>

          {/* ── ショートカット ── */}
          <section style={{ background: S.surf, borderRadius: 14, padding: "12px 12px", border: `0.5px solid ${S.border}` }}>
            <SectionLabel>ショートカット</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
              {SHORTCUTS.map(s => (
                <ShortcutTile key={s.label} icon={s.icon} label={s.label} onClick={() => openApp(s.scheme, s.fallback)} />
              ))}
            </div>
            <button
              onClick={() => router.push("/chat")}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, background: "rgba(99,102,241,0.12)", border: `0.5px solid rgba(99,102,241,0.3)`, color: S.accent2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <span>✦</span> Naviに話しかける
            </button>
            <button
              onClick={() => signOut()}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, background: "transparent", border: `0.5px solid ${S.border}`, color: S.muted, fontSize: 12, cursor: "pointer" }}
            >
              ログアウト
            </button>
          </section>

          {/* ── 注目銘柄 ── */}
          <section style={{ background: S.surf, borderRadius: 14, padding: 16, border: `0.5px solid ${S.border}` }}>
            <SectionLabel>注目銘柄</SectionLabel>
            {stocks.length > 0 ? stocks.map(s => (
              <div key={s.code} style={{ display: "flex", alignItems: "center", padding: "10px 10px", borderRadius: 8, marginBottom: 6, background: S.bg, border: `0.5px solid ${S.border}` }}>
                <div style={{ fontSize: 11, color: S.muted, minWidth: 36 }}>{s.code}</div>
                <Sparkline positive={s.positive} />
                <div style={{ fontSize: 14, fontWeight: 500, flex: 1, marginLeft: 8 }}>{s.name}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.close.toLocaleString()}円</div>
                  <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: s.positive ? "#10b981" : "#f43f5e" }}>
                    {s.positive ? "▲" : "▼"} {s.changePercent}%
                  </div>
                </div>
              </div>
            )) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
          </section>

          {/* ── ニュース ── */}
          <section style={{ background: S.surf, borderRadius: 14, padding: 16, border: `0.5px solid ${S.border}` }}>
            <SectionLabel>ニュース</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {news.length > 0 ? news.slice(0, 6).map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: S.bg, borderRadius: 10, border: `0.5px solid ${S.border}`, textDecoration: "none" }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: S.border2, lineHeight: 1, flexShrink: 0, width: 18 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, color: S.text, lineHeight: 1.5, margin: 0 }}>{n.title}</p>
                    {n.source && <p style={{ fontSize: 11, color: S.muted, margin: "4px 0 0" }}>{n.source}</p>}
                  </div>
                </a>
              )) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
            </div>
          </section>

          {/* ── スケジュール ── */}
          <section style={{ background: S.surf, borderRadius: 14, padding: 16, border: `0.5px solid ${S.border}` }}>
            <SectionLabel>スケジュール（直近7日）</SectionLabel>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {days.map((day, i) => {
                const dow = new Date(day).getUTCDay();
                const label = i === 0 ? "今日" : i === 1 ? "明日" : `${DAY_LABELS[dow]}曜`;
                const dateLabel = day.slice(5).replace("-", "/");
                const evs = eventsByDay[day] ?? [];
                return (
                  <div key={day} style={{ flex: "0 0 auto", minWidth: 100, background: S.bg, borderRadius: 10, border: `0.5px solid ${i === 0 ? "rgba(99,102,241,0.3)" : S.border}`, padding: "10px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? S.accent2 : S.muted }}>{label}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{dateLabel}</div>
                    {scheduleLoading ? (
                      <div style={{ fontSize: 10, color: S.border2 }}>...</div>
                    ) : evs.length === 0 ? (
                      <div style={{ fontSize: 11, color: S.border2 }}>—</div>
                    ) : evs.map((ev, j) => (
                      <div key={j} style={{ marginBottom: 4, padding: "4px 6px", background: S.surf, borderRadius: 5, borderLeft: `2px solid ${S.accent}` }}>
                        <div style={{ fontSize: 10, color: S.accent2, marginBottom: 1 }}>{formatEventTime(ev.start, ev.end)}</div>
                        <div style={{ fontSize: 11, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    );
  }

  // ── デスクトップ ──────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: S.bg, color: S.text, fontFamily: "var(--font-mplus), system-ui, sans-serif", overflow: "hidden" }}>

      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 20px", borderBottom: `0.5px solid ${S.border}`, background: S.surf }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotiLinkLogo size={20} bg={S.surf} />
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.05em" }}>NotiLink</span>
          <span style={{ fontSize: 11, padding: "2px 8px", background: "rgba(99,102,241,0.15)", color: S.accent2, borderRadius: 20, border: `0.5px solid rgba(99,102,241,0.3)` }}>Navi</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(16,185,129,0.2)" }} />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "220px 1fr 1fr", gridTemplateRows: "auto auto auto", gap: 1, background: S.border }}>

        <div style={{ gridColumn: 1, gridRow: "1 / 3", background: S.surf, padding: 16, borderRight: `1px solid ${S.border}` }}>
          <SectionLabel>ショートカット</SectionLabel>
          {SHORTCUTS.map(s => (
            <ShortcutRow key={s.label} icon={s.icon} label={s.label} desc={s.desc} onClick={() => openApp(s.scheme, s.fallback)} />
          ))}
          <div style={{ height: 0.5, background: S.border, margin: "12px 0" }} />
          <SectionLabel>クイックアクション</SectionLabel>
          <ShortcutRow label="Navi" desc="メモ登録・検索" onClick={() => router.push("/chat")} />
          <ShortcutRow label="ログアウト" desc="" onClick={() => signOut()} />
        </div>

        <div style={{ gridColumn: 2, gridRow: 1, background: S.bg, padding: 16 }}>
          <SectionLabel>天気 — 大阪</SectionLabel>
          {weather ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06))", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  <img src={weather.icon} alt={weather.condition} style={{ width: 52, height: 52 }} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 38, fontWeight: 500, lineHeight: 1 }}>{weather.temp}°</span>
                    <span style={{ fontSize: 14, color: S.muted }}>体感 {weather.feelsLike}°</span>
                  </div>
                  <div style={{ fontSize: 14, color: S.muted, marginTop: 4 }}>{weather.condition}</div>
                  <div style={{ fontSize: 13, color: S.accent2, marginTop: 2 }}>大阪市 · 最高{weather.tempMax}° 最低{weather.tempMin}°</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 14 }}>
                {[
                  { icon: <Droplets size={12} color="#60a5fa" />, label: "湿度", value: `${weather.humidity}%` },
                  { icon: <Wind size={12} color="#94a3b8" />, label: "風速", value: `${weather.windSpeed}m/s` },
                  { icon: <Gauge size={12} color="#a78bfa" />, label: "気圧", value: `${weather.pressure}hPa` },
                  ...(weather.rain != null ? [{ icon: <Umbrella size={12} color="#818cf8" />, label: "降水", value: `${weather.rain}mm/h` }] : []),
                  ...(weather.sunrise ? [{ icon: <Sunrise size={12} color="#fb923c" />, label: "日の出", value: weather.sunrise }] : []),
                  ...(weather.sunset ? [{ icon: <Sunset size={12} color="#f97316" />, label: "日の入", value: weather.sunset }] : []),
                ].map((stat, i) => (
                  <div key={i} style={{ padding: "6px 8px", background: S.surf, borderRadius: 8, border: `0.5px solid ${S.border}` }}>
                    <div style={{ fontSize: 11, color: S.muted, display: "flex", alignItems: "center", gap: 3 }}>
                      {stat.icon}{stat.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: S.text, marginTop: 2 }}>{stat.value}</div>
                  </div>
                ))}
              </div>
              {weather.forecast && (
                <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                  {weather.forecast.map((slot, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", padding: "6px 7px", background: S.surf, borderRadius: 6, border: `0.5px solid ${S.border}` }}>
                      <div style={{ fontSize: 12, color: S.muted }}>{slot.time}</div>
                      <img src={slot.icon} alt="" style={{ width: 36, height: 36, margin: "0 auto", display: "block" }} />
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{slot.temp}°</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
        </div>

        <div style={{ gridColumn: 3, gridRow: 1, background: S.bg, padding: 16 }}>
          <SectionLabel>注目銘柄</SectionLabel>
          {stocks.length > 0 ? stocks.map(s => (
            <div key={s.code} style={{ display: "flex", alignItems: "center", padding: "9px 10px", borderRadius: 8, marginBottom: 4, background: S.surf, border: `0.5px solid ${S.border}` }}>
              <div style={{ fontSize: 12, color: S.muted, minWidth: 36 }}>{s.code}</div>
              <Sparkline positive={s.positive} />
              <div style={{ fontSize: 14, fontWeight: 500, flex: 1, marginLeft: 8 }}>{s.name}</div>
              <div style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.close.toLocaleString()}円</div>
              <div style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, marginLeft: 8, fontVariantNumeric: "tabular-nums", minWidth: 72, textAlign: "right", color: s.positive ? "#10b981" : "#f43f5e", background: s.positive ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)" }}>
                {s.positive ? "▲" : "▼"} {s.changePercent}%
              </div>
            </div>
          )) : <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>}
        </div>

        <div style={{ gridColumn: "2 / 4", gridRow: 2, background: S.bg, padding: 16 }}>
          <SectionLabel>ニュース</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {news.length > 0 ? news.slice(0, 6).map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: S.surf, borderRadius: 8, border: `0.5px solid ${S.border}`, textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 500, color: S.border2, lineHeight: 1, flexShrink: 0, width: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p style={{ fontSize: 13, color: S.text, lineHeight: 1.5 }}>{n.title}</p>
                  {n.source && <p style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{n.source}</p>}
                </div>
              </a>
            )) : <p style={{ fontSize: 13, color: S.muted, gridColumn: "1/3" }}>読み込み中...</p>}
          </div>
        </div>

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
                  <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? S.accent2 : S.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{dateLabel}</div>
                  {scheduleLoading ? (
                    <div style={{ fontSize: 10, color: S.border2 }}>...</div>
                  ) : evs.length === 0 ? (
                    <div style={{ fontSize: 11, color: S.border2 }}>—</div>
                  ) : evs.map((ev, j) => (
                    <div key={j} style={{ marginBottom: 4, padding: "4px 6px", background: S.surf2, borderRadius: 5, borderLeft: `2px solid ${S.accent}` }}>
                      <div style={{ fontSize: 10, color: S.accent2, marginBottom: 1 }}>{formatEventTime(ev.start, ev.end)}</div>
                      <div style={{ fontSize: 12, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
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
