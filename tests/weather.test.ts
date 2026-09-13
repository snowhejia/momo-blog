import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherService } from "../server/weather";
test("天气失败、错误响应不生成虚假天气", async () => {
  for (const f of [
    async () => {
      throw new Error("offline");
    },
    async () => new Response("{}", { status: 503 }),
    async () => Response.json({ current: { temperature_2m: "wrong" } }),
  ]) {
    const weather = createWeatherService(f as typeof fetch);
    assert.deepEqual(await weather(), { available: false });
  }
});
test("天气缓存与同时请求合并", async () => {
  let calls = 0;
  const weather = createWeatherService((async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return Response.json({
      current: { temperature_2m: 18.5, weather_code: 1 },
    });
  }) as typeof fetch);
  const results = await Promise.all([weather(), weather(), weather()]);
  assert.equal(calls, 1);
  assert.equal(results[0].temperature, 18.5);
  assert.equal(results[0].available, true);
  await weather();
  assert.equal(calls, 1);
});
