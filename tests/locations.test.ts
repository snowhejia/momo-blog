import test from "node:test";
import assert from "node:assert/strict";
import { createLocationSearch } from "../server/locations";

test("城市搜索编码查询，返回可用城市并过滤无效时区或坐标", async () => {
  const search = createLocationSearch((async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "geocoding-api.open-meteo.com");
    assert.equal(url.searchParams.get("name"), "上海, 中国");
    assert.equal(url.searchParams.get("language"), "zh");
    return Response.json({
      results: [
        {
          name: "上海",
          country_code: "CN",
          country: "中国",
          admin1: "上海市",
          latitude: 31.22,
          longitude: 121.46,
          timezone: "Asia/Shanghai",
        },
        { name: "bad", latitude: 10, longitude: 200, timezone: "UTC" },
        { name: "bad", latitude: 10, longitude: 20, timezone: "invalid" },
        null,
      ],
    });
  }) as typeof fetch);
  assert.deepEqual(await search("上海, 中国"), [
    {
      name: "上海",
      region: "CN",
      country: "中国",
      area: "上海市",
      latitude: 31.22,
      longitude: 121.46,
      timeZone: "Asia/Shanghai",
    },
  ]);
});
test("城市搜索区分无结果与上游故障", async () => {
  const empty = createLocationSearch((async () =>
    Response.json({})) as typeof fetch);
  assert.deepEqual(await empty("not-a-city"), []);
  for (const fetcher of [
    async () => {
      throw new Error("offline");
    },
    async () => new Response("{}", { status: 503 }),
    async () => Response.json({ results: "invalid" }),
  ]) {
    const search = createLocationSearch(fetcher as typeof fetch);
    await assert.rejects(() => search("上海"), /城市搜索暂不可用/);
  }
});
