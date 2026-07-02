/* The budget as weather: the fuller your week, the worse the forecast.
   Ambient rain density follows along; 100% brings the storm (and lightning). */

export interface WeatherStage {
  emoji: string
  label: string
  /** opacity for the ambient background rain */
  rain: number
}

export function weatherFor(pct: number): WeatherStage {
  if (pct >= 100) return { emoji: '⛈️', label: 'Storm overhead. No more yeses this week.', rain: 0.35 }
  if (pct >= 75) return { emoji: '🌧️', label: 'Heavy rain. One yes away from a storm.', rain: 0.26 }
  if (pct >= 50) return { emoji: '🌦️', label: 'Drizzle setting in. Choose carefully.', rain: 0.18 }
  if (pct >= 25) return { emoji: '☁️', label: 'Clouds rolling in.', rain: 0.12 }
  return { emoji: '🌤️', label: 'Clear skies.', rain: 0.07 }
}
