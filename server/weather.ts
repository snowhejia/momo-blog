import {
  DEFAULT_LOCATION,
  weatherLocationKey,
  type Weather,
  type WeatherLocation,
} from "../shared/model.js";
export function createWeatherService(fetcher: typeof fetch = fetch) {
  const cache = new Map<
    string,
    {
      cached: Weather | null;
      nextFetch: number;
      pending: Promise<Weather> | null;
    }
  >();
  return async function weather(
    location: WeatherLocation = DEFAULT_LOCATION,
  ): Promise<Weather> {
    const key = weatherLocationKey(location);
    let entry = cache.get(key);
    if (!entry) {
      // Bound the cache used by saved locations and admin previews.
      if (cache.size >= 32) cache.delete(cache.keys().next().value!);
      entry = { cached: null, nextFetch: 0, pending: null };
      cache.set(key, entry);
    }
    const state = entry;
    if (Date.now() < state.nextFetch && state.cached) return state.cached;
    if (state.pending) return state.pending;
    state.pending = (async () => {
      try {
        const query = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          current: "temperature_2m,weather_code",
          timezone: location.timeZone,
        });
        const res = await fetcher(
          `https://api.open-meteo.com/v1/forecast?${query}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) throw new Error("weather unavailable");
        const data = await res.json();
        if (
          !Number.isFinite(data.current?.temperature_2m) ||
          !Number.isFinite(data.current?.weather_code)
        )
          throw new Error("invalid weather");
        state.cached = {
          available: true,
          temperature: data.current.temperature_2m,
          code: data.current.weather_code,
          updatedAt: new Date().toISOString(),
          stale: false,
        };
        state.nextFetch = Date.now() + 15 * 60_000;
      } catch {
        state.cached = state.cached?.available
          ? { ...state.cached, stale: true }
          : { available: false };
        state.nextFetch = Date.now() + 60_000;
      }
      return state.cached;
    })().finally(() => {
      state.pending = null;
    });
    return state.pending;
  };
}
