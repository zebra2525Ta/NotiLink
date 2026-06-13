import { NextResponse } from "next/server";

const ICONS: Record<string, string> = {
  "01": "☀️", "02": "🌤️", "03": "☁️", "04": "☁️",
  "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️",
};

export async function GET() {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Osaka&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=ja`
    );
    const data = await res.json();

    if (!data.weather?.[0] || !data.main) {
      console.error("[weather] unexpected response:", JSON.stringify(data));
      return NextResponse.json({ error: "weather data unavailable" }, { status: 502 });
    }

    const iconKey = (data.weather[0].icon as string).slice(0, 2);
    return NextResponse.json({
      condition: data.weather[0].description,
      temp: Math.round(data.main.temp),
      tempMax: Math.round(data.main.temp_max),
      tempMin: Math.round(data.main.temp_min),
      humidity: data.main.humidity,
      icon: ICONS[iconKey] ?? "🌡️",
    });
  } catch (error) {
    console.error("[weather]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
