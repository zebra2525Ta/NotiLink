import { NextResponse } from "next/server";

const ICONS: Record<string, string> = {
  "01": "☀️", "02": "🌤️", "03": "☁️", "04": "☁️",
  "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️",
};

export async function GET() {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=Osaka&appid=${key}&units=metric&lang=ja`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Osaka&appid=${key}&units=metric&lang=ja&cnt=4`),
    ]);
    const [data, fdata] = await Promise.all([currentRes.json(), forecastRes.json()]);

    if (!data.weather?.[0] || !data.main) {
      console.error("[weather] unexpected response:", JSON.stringify(data));
      return NextResponse.json({ error: "weather data unavailable" }, { status: 502 });
    }

    const iconKey = (data.weather[0].icon as string).slice(0, 2);

    const forecast = [
      { time: "今", icon: ICONS[iconKey] ?? "🌡️", temp: Math.round(data.main.temp) },
      ...((fdata.list ?? []) as { dt: number; weather: { icon: string }[]; main: { temp: number } }[])
        .slice(0, 4)
        .map((item) => {
          const hour = new Date(item.dt * 1000).getHours();
          const ik = (item.weather[0].icon as string).slice(0, 2);
          return { time: `${hour}時`, icon: ICONS[ik] ?? "🌡️", temp: Math.round(item.main.temp) };
        }),
    ];

    return NextResponse.json({
      condition: data.weather[0].description,
      temp: Math.round(data.main.temp),
      tempMax: Math.round(data.main.temp_max),
      tempMin: Math.round(data.main.temp_min),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: Math.round((data.wind?.speed ?? 0) * 10) / 10,
      rain: data.rain?.["1h"] ?? null,
      icon: ICONS[iconKey] ?? "🌡️",
      forecast,
    });
  } catch (error) {
    console.error("[weather]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
