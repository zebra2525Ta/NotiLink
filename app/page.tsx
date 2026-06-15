"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NotiLinkLogo from "@/app/components/NotiLinkLogo";

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
  humidity: number; pressure: number; icon: string; forecast?: ForecastSlot[];
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

export default function Home() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [time, setTime] = useState("");
  const [input, setInput] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/weather").then(r => r.json()).then(setWeather).catch(() => null);
    fetch("/api/news").then(r => r.json()).then(setNews).catch(() => []);
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => []);

    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setTime(`${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function handleSend() {
    const q = input.trim();
    if (q) sessionStorage.setItem("chatPreset", q);
    router.push("/chat");
  }

  return (
    <div style={{ background: S.bg, minHeight: "100vh", color: S.text, fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── Topbar ── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: `0.5px solid ${S.border}`, background: S.surf, position: "sticky", top: 0, zIndex: 10 }}>
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

      {/* ── Main grid ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr 1fr", gridTemplateRows: "auto auto", gap: 1, background: S.border, paddingBottom: 52 }}>

        {/* Col 1: Shortcuts (spans 2 rows) */}
        <div style={{ gridColumn: 1, gridRow: "1 / 3", background: S.surf, padding: 16, borderRight: `1px solid ${S.border}` }}>
          <SectionLabel>ショートカット</SectionLabel>
          {SHORTCUTS.map(s => (
            <ShortcutRow key={s.label} icon={s.icon} label={s.label} desc={s.desc} onClick={() => openApp(s.scheme, s.fallback)} />
          ))}
          <div style={{ height: 0.5, background: S.border, margin: "12px 0" }} />
          <SectionLabel>クイックアクション</SectionLabel>
          <ShortcutRow label="メモを追加" desc="新規ノート作成" onClick={() => router.push("/chat")} />
          <ShortcutRow label="検索" desc="全体横断検索" onClick={() => router.push("/chat")} />
        </div>

        {/* Col 2: Weather */}
        <div style={{ gridColumn: 2, gridRow: 1, background: S.bg, padding: 16, position: "relative", overflow: "hidden" }}>
          <SectionLabel>天気 — 大阪</SectionLabel>
          {weather ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06))", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                    {weather.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{weather.temp}°</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{weather.condition}</div>
                    <div style={{ fontSize: 11, color: S.accent2, marginTop: 2 }}>大阪市 · 湿度 {weather.humidity}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, textAlign: "right" }}>
                  <span style={{ fontSize: 12, color: S.muted }}>最高 <span style={{ color: S.text, fontWeight: 500 }}>{weather.tempMax}°</span></span>
                  <span style={{ fontSize: 12, color: S.muted }}>最低 <span style={{ color: S.text, fontWeight: 500 }}>{weather.tempMin}°</span></span>
                  <span style={{ fontSize: 12, color: S.muted }}>気圧 <span style={{ color: S.text, fontWeight: 500 }}>{weather.pressure}hPa</span></span>
                </div>
              </div>
              {/* Hourly forecast bar */}
              {weather.forecast && (
                <div style={{ display: "flex", gap: 3, marginTop: 14 }}>
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
          ) : (
            <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>
          )}
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
          )) : (
            <p style={{ fontSize: 13, color: S.muted }}>読み込み中...</p>
          )}
        </div>

        {/* Col 2-3: News */}
        <div style={{ gridColumn: "2 / 4", gridRow: 2, background: S.bg, padding: 16 }}>
          <SectionLabel>ニュース</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {news.length > 0 ? news.slice(0, 4).map((n, i) => (
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
            )) : (
              <p style={{ fontSize: 13, color: S.muted, gridColumn: "1/3" }}>読み込み中...</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Bottom AI input ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: S.surf, borderTop: `1px solid ${S.border}` }}>
        <span style={{ fontSize: 16, color: S.accent2, flexShrink: 0 }}>✦</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="AIに質問する、メモする、タスクを追加..."
          style={{ flex: 1, background: S.surf2, border: `0.5px solid ${S.border2}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: S.text, outline: "none" }}
        />
        <button onClick={handleSend}
          style={{ background: S.accent, border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
          ↑ 送信
        </button>
      </div>

    </div>
  );
}
