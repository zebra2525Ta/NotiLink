import { NextResponse } from "next/server";

const owIcon = (code: string) =>
  `https://openweathermap.org/img/wn/${code}@2x.png`;

export async function GET() {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=Osaka&appid=${key}&units=metric&lang=ja`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Osaka&appid=${key}&units=metric&lang=ja&cnt=5`),
    ]);
    const [data, fdata] = await Promise.all([currentRes.json(), forecastRes.json()]);

    if (!data.weather?.[0] || !data.main) {
      console.error("[weather] unexpected response:", JSON.stringify(data));
      return NextResponse.json({ error: "weather data unavailable" }, { status: 502 });
    }

    const forecast = [
      { time: "今", icon: owIcon(data.weather[0].icon), temp: Math.round(data.main.temp) },
      ...((fdata.list ?? []) as { dt: number; weather: { icon: string }[]; main: { temp: number } }[])
        .slice(0, 5)
        .map((item) => {
          const hour = new Date(item.dt * 1000).getHours();
          return { time: `${hour}時`, icon: owIcon(item.weather[0].icon), temp: Math.round(item.main.temp) };
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
      sunrise: data.sys?.sunrise
        ? new Date(data.sys.sunrise * 1000).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
        : null,
      sunset: data.sys?.sunset
        ? new Date(data.sys.sunset * 1000).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
        : null,
      icon: owIcon(data.weather[0].icon),
      forecast,
    });
  } catch (error) {
    console.error("[weather]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
