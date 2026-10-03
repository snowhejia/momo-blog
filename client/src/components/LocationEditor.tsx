import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPin, Search } from "lucide-react";
import {
  weatherLocationSchema,
  type LocationResult,
  type SiteLocation,
} from "../../../shared/model";
import { useSite } from "../store";
import { request } from "../api";
import { Dialog } from "./Common";
import { useClock } from "./HomeCards";

const commonZones: Record<string, string> = {
  "Australia/Sydney": "悉尼 / 墨尔本",
  "Australia/Brisbane": "布里斯班",
  "Australia/Perth": "珀斯",
  "Asia/Shanghai": "北京 / 上海",
  "Asia/Hong_Kong": "香港",
  "Asia/Taipei": "台北",
  "Asia/Tokyo": "东京",
  "Asia/Singapore": "新加坡",
  "Europe/London": "伦敦",
  "America/New_York": "纽约",
  "America/Los_Angeles": "洛杉矶",
  "Pacific/Auckland": "奥克兰",
  UTC: "协调世界时",
};
const zones = [
  ...new Set([
    ...Object.keys(commonZones),
    ...Intl.supportedValuesOf("timeZone"),
  ]),
];

export function LocationEditor({ onClose }: { onClose: () => void }) {
  const { content, change } = useSite();
  const location = content!.location;
  const now = useClock();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [latitude, setLatitude] = useState(String(location.latitude));
  const [longitude, setLongitude] = useState(String(location.longitude));
  const [coordinateError, setCoordinateError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setLatitude(String(location.latitude));
    setLongitude(String(location.longitude));
    setCoordinateError("");
  }, [location.latitude, location.longitude]);
  const update = (value: Partial<SiteLocation>) =>
    change((c) => ({ ...c, location: { ...c.location, ...value } }));
  const search = async (event: FormEvent) => {
    event.preventDefault();
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setSearching(true);
    setError("");
    setNotice("");
    setResults(null);
    try {
      const found = await request<LocationResult[]>(
        `/api/locations?q=${encodeURIComponent(query.trim())}`,
        { signal: pending.signal },
      );
      if (!pending.signal.aborted) setResults(found);
    } catch (e) {
      if (!pending.signal.aborted) setError((e as Error).message);
    } finally {
      if (!pending.signal.aborted) setSearching(false);
    }
  };
  const choose = ({ country, area, ...value }: LocationResult) => {
    update(value);
    setResults(null);
    setQuery("");
    setNotice(`已选择 ${value.name}，时区和天气位置已更新。`);
  };
  const applyCoordinates = (event: FormEvent) => {
    event.preventDefault();
    const parsed = weatherLocationSchema.safeParse({
      latitude: latitude.trim() ? Number(latitude) : NaN,
      longitude: longitude.trim() ? Number(longitude) : NaN,
      timeZone: location.timeZone,
    });
    if (!parsed.success) {
      setCoordinateError(
        "纬度需在 -90 至 90 之间，经度需在 -180 至 180 之间。",
      );
      return;
    }
    update(parsed.data);
    setCoordinateError("");
    setNotice("天气位置已更新。");
  };
  return (
    <Dialog
      title="编辑地点与时区"
      eyebrow="修改会暂存于页面，点击底部「保存修改」后发布"
      onClose={onClose}
    >
      <div className="editor-fields location-editor">
        <div className="location-preview" aria-live="polite">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <strong>
              {[location.name, location.region].filter(Boolean).join(", ") ||
                "你的地点"}
            </strong>
            <span>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: location.timeZone,
                dateStyle: "medium",
                timeStyle: "short",
                hourCycle: "h23",
              }).format(now)}
            </span>
          </div>
        </div>
        <form className="location-search" onSubmit={search}>
          <label htmlFor="city-query">查找城市</label>
          <div>
            <input
              id="city-query"
              value={query}
              minLength={2}
              maxLength={80}
              required
              placeholder="例如：上海、东京、London"
              onChange={(e) => {
                controller.current?.abort();
                setSearching(false);
                setResults(null);
                setError("");
                setQuery(e.target.value);
              }}
            />
            <button
              className="button dark"
              disabled={searching || query.trim().length < 2}
            >
              <Search size={15} />
              {searching ? "查找中…" : "搜索"}
            </button>
          </div>
          <small>选择城市后，自动填写地点、时区和天气位置。</small>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {results &&
          (results.length ? (
            <ul className="location-results" aria-label="城市搜索结果">
              {results.map((result, index) => (
                <li key={`${result.latitude},${result.longitude},${index}`}>
                  <button type="button" onClick={() => choose(result)}>
                    <strong>{result.name}</strong>
                    <span>
                      {[result.area, result.country]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <small>{result.timeZone}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="location-note">
              没有找到城市，试试英文名称或加上国家名称。
            </p>
          ))}
        {notice && (
          <p className="location-note" role="status">
            {notice}
          </p>
        )}
        <div className="location-fields-row">
          <label>
            地点名称
            <input
              value={location.name}
              maxLength={80}
              placeholder="例如：Sydney 或悉尼"
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <label>
            地区标记（可选）
            <input
              value={location.region}
              maxLength={40}
              placeholder="例如：AU 或中国"
              onChange={(e) => update({ region: e.target.value })}
            />
          </label>
        </div>
        <label>
          时区
          <select
            value={location.timeZone}
            onChange={(e) => update({ timeZone: e.target.value })}
          >
            {!zones.includes(location.timeZone) && (
              <option value={location.timeZone}>{location.timeZone}</option>
            )}
            <optgroup label="常用时区">
              {Object.entries(commonZones).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} · {value}
                </option>
              ))}
            </optgroup>
            <optgroup label="全部时区">
              {zones
                .filter((zone) => !commonZones[zone])
                .map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
            </optgroup>
          </select>
          <small>时钟、日历和签到按此时区计算，夏令时会自动切换。</small>
        </label>
        <details className="location-coordinates">
          <summary>手动设置天气位置</summary>
          <p>天气按经纬度获取。只修改地点名称或时区，不会改变天气位置。</p>
          <form onSubmit={applyCoordinates}>
            <div className="location-fields-row">
              <label>
                纬度
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </label>
              <label>
                经度
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </label>
            </div>
            {coordinateError && (
              <p className="form-error" role="alert">
                {coordinateError}
              </p>
            )}
            <button className="button" type="submit">
              应用天气位置
            </button>
          </form>
        </details>
        <button className="button dark editor-done" onClick={onClose}>
          返回首页预览
        </button>
      </div>
    </Dialog>
  );
}
