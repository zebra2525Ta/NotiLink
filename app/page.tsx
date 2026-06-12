"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SHORTCUTS = [
  { label: "Notion", scheme: "notion://", fallback: "https://notion.so", icon: "N" },
  { label: "カレンダー", scheme: "notion://", fallback: "https://calendar.notion.so", icon: "📅" },
  { label: "SmartNews", scheme: "smartnews://", fallback: "https://smartnews.com", icon: "📰" },
  { label: "SBI証券", scheme: "sbisec://", fallback: "https://www.sbisec.co.jp", icon: "📈" },
];

function openApp(scheme: string, fallback: string) {
  window.location.href = scheme;
  setTimeout(() => { window.location.href = fallback; }, 1000);
}

type Weather = {
  condition: string;
  temp: number;
  tempMax: number;
  tempMin: number;
  humidity: number;
  icon: string;
};

type NewsItem = { title: string; link: string };

type Stock = {
  code: string;
  name: string;
  close: number;
  change: string;
  changePercent: string;
  positive: boolean;
  date: string;
};

export default function Home() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  useEffect(() => {
    fetch("/api/weather").then(r => r.json()).then(setWeather).catch(() => null);
    fetch("/api/news").then(r => r.json()).then(setNews).catch(() => []);
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => []);
  }, []);

  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-white">
      <header className="flex items-center px-5 py-4 border-b border-gray-800">
        <span className="text-base font-semibold tracking-wide">AI秘書</span>
      </header>

      <div className="flex-1 flex flex-col gap-5 p-5 overflow-y-auto pb-24">

        {/* ショートカット */}
        <section>
          <h2 className="text-xs text-gray-500 font-medium mb-3 tracking-widest uppercase">ショートカット</h2>
          <div className="grid grid-cols-4 gap-3">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                onClick={() => openApp(s.scheme, s.fallback)}
                className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors active:scale-95"
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-xs text-gray-300 text-center leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 天気 */}
        <section>
          <h2 className="text-xs text-gray-500 font-medium mb-3 tracking-widest uppercase">天気（東京）</h2>
          <div className="bg-gray-800 rounded-2xl px-5 py-4">
            {weather ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{weather.icon}</span>
                  <div>
                    <p className="text-2xl font-semibold">{weather.temp}°</p>
                    <p className="text-xs text-gray-400">{weather.condition}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 space-y-1">
                  <p>最高 {weather.tempMax}° / 最低 {weather.tempMin}°</p>
                  <p>湿度 {weather.humidity}%</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">読み込み中...</p>
            )}
          </div>
        </section>

        {/* ニュース */}
        <section>
          <h2 className="text-xs text-gray-500 font-medium mb-3 tracking-widest uppercase">ニュース</h2>
          <div className="bg-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-700">
            {news.length > 0 ? news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-5 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors leading-snug"
              >
                {n.title}
              </a>
            )) : (
              <p className="px-5 py-4 text-gray-500 text-sm">読み込み中...</p>
            )}
          </div>
        </section>

        {/* 株価 */}
        <section>
          <h2 className="text-xs text-gray-500 font-medium mb-3 tracking-widest uppercase">注目銘柄</h2>
          <div className="bg-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-700">
            {stocks.length > 0 ? stocks.map((s) => (
              <div key={s.code} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-100">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{s.close.toLocaleString()}円</p>
                  <p className={`text-xs font-medium ${s.positive ? "text-green-400" : "text-red-400"}`}>
                    {s.change} ({s.changePercent}%)
                  </p>
                </div>
              </div>
            )) : (
              <p className="px-5 py-4 text-gray-500 text-sm">読み込み中...</p>
            )}
          </div>
        </section>
      </div>

      {/* チャットボタン */}
      <div className="fixed bottom-6 right-5">
        <Link
          href="/chat"
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full text-sm font-medium shadow-lg transition-colors"
        >
          <span>✏️</span>
          <span>メモする</span>
        </Link>
      </div>
    </main>
  );
}
