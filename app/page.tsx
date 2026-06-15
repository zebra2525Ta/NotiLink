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
  const pts = positive
    ? "0,20 10,17 20,14 30,11 40,7 50,5"
    : "0,5 10,8 20,11 30,14 40,17 50,20";
  const color = positive ? "#10b981" : "#f43f5e";
  return (
    <svg width="50" height="24" viewBox="0 0 50 24" fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

type Weather = {
  condition: string;
  temp: number;
  tempMax: number;
  tempMin: number;
  humidity: number;
  pressure: number;
  icon: string;
};
type NewsItem = { title: string; link: string };
type Stock = {
  code: string; name: string; close: number;
  change: string; changePercent: string; positive: boolean; date: string;
};

const BG = "#0d0f14";
const SURF = "#141720";
const SURF2 = "#1a1e2a";
const BORDER = "rgba(255,255,255,0.07)";
const BORDER2 = "rgba(255,255,255,0.12)";
const MUTED = "#6b7280";
const TEXT = "#e8eaf0";
const ACCENT = "#6366f1";
const ACCENT2 = "#818cf8";

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
      setTime(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function handleSend() {
    const q = input.trim();
    if (!q) { router.push("/chat"); return; }
    sessionStorage.setItem("chatPreset", q);
    router.push("/chat");
  }

  const label = (txt: string) => (
    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", marginBottom: 10 }}>
      {txt}
    </p>
  );

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "system-ui,sans-serif", paddingBottom: 60 }}>

      {/* ── Topbar ── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `0.5px solid ${BORDER}`, background: SURF, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NotiLinkLogo size={22} bg={SURF} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.05em" }}>NotiLink</span>
          <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.15)", color: ACCENT2, borderRadius: 20, border: `0.5px solid rgba(99,102,241,0.3)` }}>AI秘書</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{time}</span>
          <div style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(16,185,129,0.2)" }} />
        </div>
      </header>

      <div style={{ padding: "0 0 8px" }}>

        {/* ── ショートカット ── */}
        <section style={{ padding: "14px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
          {label("ショートカット")}
          {SHORTCUTS.map(s => (
            <button
              key={s.label}
              onClick={() => openApp(s.scheme, s.fallback)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4, width: "100%", background: "transparent", border: "none", color: TEXT, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = SURF2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.icon} alt={s.label} style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: `0.5px solid ${BORDER2}`, flexShrink: 0 }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </section>

        {/* ── 天気 ── */}
        <section style={{ padding: "14px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
          {label("天気 — 大阪")}
          {weather ? (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06))", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                    {weather.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{weather.temp}°</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{weather.condition}</div>
                    <div style={{ fontSize: 11, color: ACCENT2, marginTop: 2 }}>湿度 {weather.humidity}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, textAlign: "right" }}>
                  <span style={{ fontSize: 12, color: MUTED }}>最高 <span style={{ color: TEXT, fontWeight: 500 }}>{weather.tempMax}°</span></span>
                  <span style={{ fontSize: 12, color: MUTED }}>最低 <span style={{ color: TEXT, fontWeight: 500 }}>{weather.tempMin}°</span></span>
                  <span style={{ fontSize: 12, color: MUTED }}>気圧 <span style={{ color: TEXT, fontWeight: 500 }}>{weather.pressure}hPa</span></span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: MUTED }}>読み込み中...</p>
          )}
        </section>

        {/* ── 注目銘柄 ── */}
        <section style={{ padding: "14px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
          {label("注目銘柄")}
          {stocks.length > 0 ? stocks.map(s => (
            <div key={s.code} style={{ display: "flex", alignItems: "center", padding: "9px 10px", borderRadius: 8, marginBottom: 4, background: SURF, border: `0.5px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, color: MUTED, minWidth: 36 }}>{s.code}</div>
              <Sparkline positive={s.positive} />
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1, marginLeft: 8 }}>{s.name}</div>
              <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.close.toLocaleString()}円</div>
              <div style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 4, marginLeft: 8, fontVariantNumeric: "tabular-nums", minWidth: 72, textAlign: "right",
                color: s.positive ? "#10b981" : "#f43f5e",
                background: s.positive ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
              }}>
                {s.positive ? "▲" : "▼"} {s.changePercent}%
              </div>
            </div>
          )) : (
            <p style={{ fontSize: 13, color: MUTED }}>読み込み中...</p>
          )}
        </section>

        {/* ── ニュース ── */}
        <section style={{ padding: "14px 16px" }}>
          {label("ニュース")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {news.length > 0 ? news.slice(0, 4).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: SURF, borderRadius: 8, border: `0.5px solid ${BORDER}`, cursor: "pointer", textDecoration: "none" }}
              >
                <span style={{ fontSize: 20, fontWeight: 500, color: BORDER2, lineHeight: 1, flexShrink: 0, width: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{n.title}</p>
                </div>
              </a>
            )) : (
              <p style={{ fontSize: 13, color: MUTED, gridColumn: "1/3" }}>読み込み中...</p>
            )}
          </div>
        </section>
      </div>

      {/* ── Bottom AI input ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: SURF, borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 16, color: ACCENT2, flexShrink: 0 }}>✦</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="AIに質問する、メモする、タスクを追加..."
          style={{ flex: 1, background: SURF2, border: `0.5px solid ${BORDER2}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: TEXT, outline: "none" }}
        />
        <button
          onClick={handleSend}
          style={{ background: ACCENT, border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          ↑ 送信
        </button>
      </div>
    </div>
  );
}
