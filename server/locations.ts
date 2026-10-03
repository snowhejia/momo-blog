import { z } from "zod";
import { locationSchema, type LocationResult } from "../shared/model.js";
import { HttpError } from "./media.js";

const resultSchema = locationSchema.extend({
  country: z.string().max(160),
  area: z.string().max(160),
});

export function createLocationSearch(fetcher: typeof fetch = fetch) {
  return async (query: string): Promise<LocationResult[]> => {
    try {
      const params = new URLSearchParams({
        name: query,
        count: "8",
        language: "zh",
        format: "json",
      });
      const response = await fetcher(
        `https://geocoding-api.open-meteo.com/v1/search?${params}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) throw new Error("location search unavailable");
      const data = await response.json();
      if (
        data.error ||
        (data.results !== undefined && !Array.isArray(data.results))
      )
        throw new Error("invalid locations");
      return (data.results || [])
        .slice(0, 8)
        .flatMap((item: Record<string, unknown> | null) => {
          if (!item) return [];
          const parsed = resultSchema.safeParse({
            name: item.name,
            region: item.country_code || "",
            latitude: item.latitude,
            longitude: item.longitude,
            timeZone: item.timezone,
            country: item.country || "",
            area: item.admin1 || "",
          });
          return parsed.success ? [parsed.data] : [];
        });
    } catch {
      throw new HttpError(
        502,
        "城市搜索暂不可用，请稍后重试，或手动设置地点、时区和天气位置。",
      );
    }
  };
}
