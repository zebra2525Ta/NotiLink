"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "misc", label: "未分類 DB ID" },
  { key: "places", label: "場所 DB ID" },
  { key: "shopping", label: "買い物 DB ID" },
  { key: "schedule", label: "スケジュール DB ID" },
] as const;

export default function Setup() {
  const router = useRouter();
  const [values, setValues] = useState({ misc: "", places: "", shopping: "", schedule: "" });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(({ dbIds }) => {
      if (dbIds) setValues(dbIds);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => router.push("/"), 1000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-white">
      <header className="flex items-center px-5 py-4 border-b border-gray-800">
        <span className="text-base font-semibold tracking-wide">初期設定</span>
      </header>

      <div className="flex-1 p-5 max-w-md w-full mx-auto">
        <p className="text-sm text-gray-400 mb-6">
          各 Notion データベースの ID を入力してください。<br />
          DB URLの末尾32文字がIDです。
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-medium">{label}</label>
              <input
                type="text"
                value={values[key]}
                onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
                required
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading || saved}
            className="mt-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            {saved ? "保存しました ✓" : loading ? "保存中..." : "保存する"}
          </button>
        </form>
      </div>
    </main>
  );
}
