import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
const folder = await mkdtemp(join(tmpdir(), "hejia-avatar-")),
  base = "http://127.0.0.1:4322";
let browser, server;
const checks = [];
try {
  server = spawn(process.execPath, ["dist/server/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: folder, PORT: "4322", APP_URL: base },
    stdio: "pipe",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/home")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_BIN ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator(".hero-avatar img").waitFor();
  await page.waitForFunction(
    () => document.querySelector(".hero-avatar img").naturalWidth > 0,
  );
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [1600, 1000],
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const state = await page.evaluate(() => {
      const avatar = document
          .querySelector(".hero-avatar")
          .getBoundingClientRect(),
        card = document.querySelector(".hero-card").getBoundingClientRect(),
        headline = document
          .querySelector(".hero-card h1")
          .getBoundingClientRect(),
        body = document.documentElement;
      return {
        avatar: { x: avatar.x, y: avatar.y, w: avatar.width, h: avatar.height },
        inside:
          avatar.left >= card.left &&
          avatar.right <= card.right &&
          avatar.top >= card.top &&
          avatar.bottom <= card.bottom,
        headlineOverlap:
          avatar.left < headline.right &&
          avatar.right > headline.left &&
          avatar.top < headline.bottom &&
          avatar.bottom > headline.top,
        overflow: body.scrollWidth > innerWidth,
        height: body.scrollHeight,
      };
    });
    assert.ok(state.inside);
    assert.equal(state.overflow, false);
    assert.equal(state.avatar.w, state.avatar.h);
    if (width > 1100) assert.equal(state.height, height);
    await page.screenshot({
      path: `artifacts/avatar-${width}.png`,
      fullPage: true,
    });
    checks.push({ width, ...state });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "查看个人介绍", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  const original = await (await fetch(base + "/api/home")).json();
  assert.ok(original.content.profile.avatarId);
  assert.equal(
    (await fetch(base + "/api/media/" + original.content.profile.avatarId))
      .status,
    200,
  );
  await page.goto(base + "/login");
  await page
    .getByLabel("初始化令牌", { exact: true })
    .fill((await readFile(join(folder, "setup-token.txt"), "utf8")).trim());
  await page.getByLabel("邮箱", { exact: true }).fill("avatar-qa@example.com");
  await page
    .getByLabel("密码", { exact: true })
    .fill("avatar-local-test-password");
  await page.getByRole("button", { name: "创建并登录", exact: true }).click();
  await page.getByRole("button", { name: "编辑页面", exact: true }).click();
  await page.getByRole("button", { name: "编辑个人头像", exact: true }).click();
  await page
    .getByLabel("上传个人头像", { exact: true })
    .setInputFiles(resolve("assets/demo/coffee.jpg"));
  await page.getByText("图片已上传", { exact: true }).waitFor();
  await page.getByRole("button", { name: "返回首页预览", exact: true }).click();
  const newUrl = await page.locator(".hero-avatar img").getAttribute("src");
  assert.ok(!newUrl.includes(original.content.profile.avatarId));
  assert.equal(
    (await (await fetch(base + "/api/home")).json()).content.profile.avatarId,
    original.content.profile.avatarId,
  );
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  const updated = await (await fetch(base + "/api/home")).json();
  assert.notEqual(
    updated.content.profile.avatarId,
    original.content.profile.avatarId,
  );
  assert.equal(
    (await fetch(base + "/api/media/" + updated.content.profile.avatarId))
      .status,
    200,
  );
  await page.reload();
  await page.locator(".hero-avatar img").waitFor();
  assert.ok(
    (await page.locator(".hero-avatar img").getAttribute("src")).includes(
      updated.content.profile.avatarId,
    ),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/avatar-qa.json",
    JSON.stringify(
      { passed: true, checks, avatarUploadAndSave: true, errors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: true, checks, avatarUploadAndSave: true, errors }),
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exit = once(server, "exit");
    server.kill("SIGTERM");
    await exit;
  }
  await rm(folder, { recursive: true, force: true });
}
