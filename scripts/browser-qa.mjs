import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const root = process.cwd(),
  artifacts = resolve("artifacts");
await mkdir(artifacts, { recursive: true });
const folder = await mkdtemp(join(tmpdir(), "hejia-browser-")),
  port = 4322,
  base = `http://127.0.0.1:${port}`;
let server, browser;
const checks = [],
  errors = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const start = async () => {
  server = spawn(process.execPath, ["dist/server/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: folder,
      PORT: String(port),
      APP_URL: base,
    },
    stdio: "pipe",
  });
  for (let n = 0; n < 80; n++) {
    try {
      const r = await fetch(`${base}/api/home`);
      if (r.ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error("QA server did not start");
};
const stop = async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
};
const check = (label) => {
  checks.push(label);
  console.log(`PASS ${label}`);
};
const chrome =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
try {
  await start();
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chrome) ? { executablePath: chrome } : {}),
  });
  const guest = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await guest.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero-card");
  await page.locator(".checkin-card .button").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("audio")?.duration > 0,
  );
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.locator(".xiaohongshu-link").getAttribute("href"),
    null,
  );
  assert.equal(
    await page.locator(".xiaohongshu-link").getAttribute("target"),
    null,
  );
  assert.equal(await page.locator(".like-count").innerText(), "0");

  for (const [width, height] of [
    [1600, 1000],
    [1440, 900],
    [820, 1180],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const size = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
      overflow: [...document.querySelectorAll(".card")]
        .filter((e) => e.scrollHeight > e.clientHeight + 2)
        .map((e) => e.className),
    }));
    const socialFits = await page.locator(".social-row").evaluate((row) => {
      const bounds = row.getBoundingClientRect();
      return [...row.children].every((child) => {
        const box = child.getBoundingClientRect();
        return (
          box.left >= bounds.left - 1 &&
          box.right <= bounds.right + 1 &&
          child.scrollWidth <= child.clientWidth + 1
        );
      });
    });
    assert.ok(
      socialFits,
      "all three social links and the like count fit in the music card",
    );
    assert.equal(size.w, width, "no horizontal overflow");
    if (width > 1100) {
      assert.equal(size.h, height, "desktop exactly one screen");
      assert.deepEqual(size.overflow, [], "no card content overflow");
    }
    await page.screenshot({
      path: join(artifacts, `homepage-${width}.png`),
      fullPage: true,
    });
  }
  check("1600×1000、1440×900 一屏无溢出；820 两列、390 单列");
  await page.getByRole("button", { name: "聊聊", exact: true }).click();
  await page
    .getByRole("heading", { name: "留一句话吧。", exact: true })
    .waitFor();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const fit = await page.locator(".contact-dialog").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        body = el.querySelector(".dialog-body");
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        body.scrollWidth <= body.clientWidth + 1
      );
    });
    assert.ok(fit, "contact form fits desktop and mobile");
    await page.screenshot({
      path: join(artifacts, `contact-form-${width}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("你的称呼", { exact: true }).fill("Browser visitor");
  await page
    .getByLabel("回复邮箱", { exact: true })
    .fill("private-browser@example.com");
  await page
    .getByLabel("留言内容", { exact: true })
    .fill("这是只给站主的浏览器测试留言。<script>不得作为脚本执行</script>");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "聊聊", exact: true }).click();
  assert.equal(
    await page.getByLabel("你的称呼", { exact: true }).inputValue(),
    "Browser visitor",
  );
  assert.ok(
    (await page.getByLabel("留言内容", { exact: true }).inputValue()).includes(
      "浏览器测试留言",
    ),
  );
  await page.route("**/api/messages", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "留言测试服务暂不可用" }),
    }),
  );
  await page.getByRole("button", { name: "发送留言", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "留言测试服务暂不可用" })
    .waitFor();
  assert.equal(
    await page.getByLabel("回复邮箱", { exact: true }).inputValue(),
    "private-browser@example.com",
  );
  await page.unroute("**/api/messages");
  await page.getByRole("button", { name: "发送留言", exact: true }).click();
  await page
    .getByRole("heading", { name: "留言已收到。", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("hejia-homepage:contact-draft"),
    ),
    null,
  );
  assert.equal((await page.request.get(`${base}/api/messages`)).status(), 401);
  await page.screenshot({ path: join(artifacts, "contact-form-success.png") });
  await page.getByRole("button", { name: "回到页面", exact: true }).click();
  check(
    "留言表单适配桌面和手机，关闭刷新保留草稿，失败可重试，成功后清空且访客无法读取留言",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  const navigate = async (name) => {
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
  };
  for (const [name, section, heading] of [
    ["项目", "projects", "作品与实验."],
    ["文字", "articles", "最近写下的."],
    ["相册", "photos", "日常切片."],
    ["收集", "collections", "收集一点喜欢."],
  ]) {
    await navigate(name);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `/${section}`);
    assert.equal(await page.locator("dialog").count(), 0);
    assert.equal(
      await page
        .getByRole("navigation")
        .getByRole("link", { name, exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    for (const [width, height] of [
      [1600, 1000],
      [1440, 900],
      [820, 1180],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      if (section === "photos") {
        await page.locator('.album-wall[data-layout="ready"]').waitFor();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const wall = await page.locator(".album-wall").evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            tiles: [...el.querySelectorAll(".album-tile")].map((tile) => {
              const r = tile.getBoundingClientRect();
              return {
                x: r.x - box.x,
                y: r.y - box.y,
                width: r.width,
                height: r.height,
              };
            }),
          };
        });
        assert.equal(wall.tiles.length, 5);
        assert.ok(
          wall.tiles[0].width > wall.tiles[1].width * 1.8,
          "Bento lead photo spans two columns",
        );
        assert.ok(
          new Set(wall.tiles.map((t) => Math.round(t.height))).size >= 3,
          "masonry uses varied photo heights",
        );
        for (const [i, tile] of wall.tiles.entries()) {
          assert.ok(tile.x >= -1 && tile.x + tile.width <= wall.width + 1);
          assert.ok(tile.y >= -1 && tile.y + tile.height <= wall.height + 1);
          for (const other of wall.tiles.slice(i + 1)) {
            assert.ok(
              tile.x + tile.width <= other.x + 1 ||
                other.x + other.width <= tile.x + 1 ||
                tile.y + tile.height <= other.y + 1 ||
                other.y + other.height <= tile.y + 1,
              "photos never overlap",
            );
          }
        }
      }
      const sizes = await page.evaluate(() => {
        const main = document.querySelector("main"),
          nav = document.querySelector(".site-header");
        return {
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
          mainWidth: main.clientWidth,
          mainScrollWidth: main.scrollWidth,
          navTop: nav.getBoundingClientRect().top,
          mainBottom: main.getBoundingClientRect().bottom,
        };
      });
      assert.equal(sizes.w, width, "no page horizontal overflow");
      assert.equal(sizes.h, height, "section fills one viewport");
      assert.ok(
        sizes.mainScrollWidth <= sizes.mainWidth + 1,
        "no section horizontal overflow",
      );
      assert.ok(sizes.mainBottom < height, "footer stays within viewport");
      await page.locator("main").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      assert.equal(
        await page
          .locator(".site-header")
          .evaluate((el) => el.getBoundingClientRect().top),
        sizes.navTop,
      );
      await page.locator("main").evaluate((el) => {
        el.scrollTop = 0;
      });
      if (width !== 820)
        await page.screenshot({
          path: join(artifacts, `${section}-${width}.png`),
        });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.reload();
    assert.equal(
      response.status(),
      200,
      "section can be opened directly or refreshed",
    );
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  check("四个全屏栏目在桌面和手机无横向溢出，滚动时导航常驻，地址刷新有效");
  await navigate("项目");
  await page.locator(".project-list > button").first().click();
  assert.ok(await page.locator(".prose").innerText());
  assert.equal(new URL(page.url()).searchParams.get("item"), "sample-project");
  await page.goBack();
  await page.locator(".project-list").waitFor();
  await page.goForward();
  await page.locator(".reading-view").waitFor();
  await page.reload();
  await page.locator(".reading-view").waitFor();
  await page.getByRole("button", { name: "所有项目", exact: true }).click();
  await page.locator(".project-list").waitFor();
  check("项目详情、浏览器前进后退、详情刷新及返回列表");
  await navigate("文字");
  await page
    .locator(".article-list > button")
    .filter({ hasText: "从一个小想法开始" })
    .click();
  assert.ok(await page.locator(".prose").innerText());
  await page.reload();
  await page.locator(".reading-view").waitFor();
  await page.getByRole("button", { name: "所有文字", exact: true }).click();
  await page.locator(".article-list").waitFor();
  await navigate("相册");
  await page.locator(".album-tile").first().click();
  const before = await page.locator(".photo-meta h3").innerText();
  await page.keyboard.press("ArrowRight");
  assert.notEqual(await page.locator(".photo-meta h3").innerText(), before);
  await page.getByRole("button", { name: "上一张照片", exact: true }).click();
  assert.equal(await page.locator(".photo-meta h3").innerText(), before);
  await page.screenshot({ path: join(artifacts, "photo-viewer.png") });
  check("文章正文预览，相册放大和键盘前后切换");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("main").evaluate((el) => {
    el.scrollTop = 100;
  });
  const albumScroll = await page.locator("main").evaluate((el) => el.scrollTop);
  await page.getByRole("button", { name: "下一张照片", exact: true }).click();
  assert.equal(
    await page.locator("main").evaluate((el) => el.scrollTop),
    albumScroll,
  );
  await page.getByRole("button", { name: "聊聊", exact: true }).click();
  const selectedPhoto = new URL(page.url()).search;
  await page.keyboard.press("ArrowRight");
  assert.equal(
    new URL(page.url()).search,
    selectedPhoto,
    "photo keys do not act through dialogs",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  check("手机切换照片不跳回页首，弹窗打开时照片快捷键暂停");
  await page.reload();
  await page.locator(".photo-stage").waitFor();
  await page.getByRole("button", { name: "返回照片墙", exact: true }).click();
  await page.locator('.album-wall[data-layout="ready"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const lastTile = page.locator(".album-tile").last();
  await lastTile.scrollIntoViewIfNeeded();
  await lastTile.focus();
  const wallScroll = await page.locator("main").evaluate((el) => el.scrollTop);
  await page.keyboard.press("Enter");
  await page.locator(".photo-stage").waitFor();
  assert.equal(await page.locator("main").evaluate((el) => el.scrollTop), 0);
  await page.keyboard.press("Escape");
  await page.locator(".album-gallery").waitFor();
  assert.equal(
    await page.locator("main").evaluate((el) => el.scrollTop),
    wallScroll,
  );
  assert.equal(
    await lastTile.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({
    path: join(artifacts, "album-masonry-mobile-scrolled.png"),
  });
  await page.goBack();
  await page.locator(".photo-stage").waitFor();
  await page.goForward();
  await page.locator(".album-gallery").waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  check(
    "瀑布流照片墙无重叠；大图支持键盘打开、刷新、Esc 返回和恢复滚动位置及焦点",
  );

  await navigate("收集");
  await page.getByRole("button", { name: "网站", exact: true }).click();
  assert.equal(await page.locator(".collection-list article").count(), 1);
  assert.ok(
    (await page.locator(".collection-list").innerText()).includes("MDN"),
  );
  assert.equal(
    await page.locator(".collection-list a").getAttribute("href"),
    "https://developer.mozilla.org/zh-CN/",
  );
  await page.reload();
  await page.locator(".collection-list article").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "网站", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByLabel("搜索收集").fill("不存在的内容");
  assert.equal(await page.locator(".collection-list article").count(), 0);
  await navigate("首页");
  check("收藏分类、搜索、空结果和来源链接，分类在刷新后保留");
  const month = await page.locator(".calendar-top h2").innerText();
  await page.getByRole("button", { name: "下个月", exact: true }).click();
  assert.notEqual(await page.locator(".calendar-top h2").innerText(), month);
  await page.getByRole("button", { name: "回到今天", exact: true }).click();
  assert.equal(await page.locator(".calendar-top h2").innerText(), month);
  check("日历切月与返回今天");
  await page.getByRole("button", { name: "今日签到", exact: true }).click();
  await page.getByRole("button", { name: "今日已签到", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "今日已签到", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "喜欢这个网站", exact: true }).click();
  await page.getByRole("button", { name: "取消喜欢", exact: true }).waitFor();
  assert.equal(await page.locator(".like-count").innerText(), "1");
  await page.getByRole("button", { name: "取消喜欢", exact: true }).click();
  await page
    .getByRole("button", { name: "喜欢这个网站", exact: true })
    .waitFor();
  assert.equal(await page.locator(".like-count").innerText(), "0");
  await page.getByRole("button", { name: "喜欢这个网站", exact: true }).click();
  await page.getByRole("button", { name: "取消喜欢", exact: true }).waitFor();

  await page.reload();
  await page.getByRole("button", { name: "今日已签到", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "取消喜欢", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".like-count").innerText(), "1");
  check("社交链接未配置时有入口；点赞数量随点赞、撤销更新且刷新后保留");
  check("签到、点赞在刷新后保留");
  await page.getByRole("button", { name: "播放音乐", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio")?.currentTime > 1,
  );
  assert.equal(await page.locator("audio").count(), 1);
  await page.getByLabel("播放进度").fill("10");
  assert.ok(
    await page.evaluate(
      () => document.querySelector("audio").currentTime >= 9.9,
    ),
  );
  await page.getByLabel("音乐设置").click();
  await page.getByLabel("音量", { exact: true }).fill("0.2");
  assert.equal(
    await page.evaluate(() => document.querySelector("audio").volume),
    0.2,
  );
  await page.getByLabel("音乐设置").click();
  const audioHandle = await page.locator("audio").elementHandle();
  for (const name of ["项目", "文字", "相册", "收集", "首页"]) {
    await navigate(name);
    assert.equal(await page.locator("audio").count(), 1);
    assert.equal(
      await page.evaluate(
        (a) => a === document.querySelector("audio") && !a.paused,
        audioHandle,
      ),
      true,
    );
  }
  check("切换全部栏目时同一个音频实例连续播放");
  await page.getByRole("button", { name: "暂停音乐", exact: true }).click();
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("audio")?.duration > 0,
  );
  assert.equal(
    await page.evaluate(() => document.querySelector("audio").paused),
    true,
  );
  assert.ok(
    (await page.evaluate(() => document.querySelector("audio").currentTime)) >=
      9.9,
  );
  check("单音频实例真实播放、暂停、拖动、音量；刷新后暂停");
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(`${base}/login`);
  await admin.getByRole("heading", { name: "创建你的管理员账号" }).waitFor();
  const token = (
    await readFile(join(folder, "setup-token.txt"), "utf8")
  ).trim();
  await admin.getByLabel("初始化令牌", { exact: true }).fill(token);
  await admin
    .getByLabel("邮箱", { exact: true })
    .fill("browser-qa@example.com");
  await admin
    .getByLabel("密码", { exact: true })
    .fill("local-browser-test-12345");
  await admin.getByRole("button", { name: "创建并登录", exact: true }).click();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  const statsBefore = await (await fetch(`${base}/api/stats`)).json();
  await admin.reload();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  const statsAfter = await (await fetch(`${base}/api/stats`)).json();
  assert.equal(statsAfter.totalViews, statsBefore.totalViews);
  check("用户自行初始化管理员、真实登录，管理员预览不计入访问");
  await admin.getByRole("button", { name: "留言箱", exact: true }).click();
  await admin.locator(".inbox-message").waitFor();
  assert.equal(await admin.locator(".inbox-message").count(), 1);
  assert.ok(
    (await admin.locator(".inbox-message").innerText()).includes(
      "<script>不得作为脚本执行</script>",
    ),
  );
  await admin.getByRole("button", { name: "标为已读", exact: true }).click();
  await admin.getByRole("button", { name: "设为未读", exact: true }).waitFor();
  await admin.screenshot({ path: join(artifacts, "private-inbox.png") });
  const extraMessage = {
    submissionId: crypto.randomUUID(),
    name: "要删除的测试留言",
    email: "",
    body: "用于检查管理员删除功能",
    website: "",
  };
  assert.equal(
    (
      await page.request.post(`${base}/api/messages`, { data: extraMessage })
    ).status(),
    201,
  );
  await admin.getByRole("button", { name: "刷新", exact: true }).click();
  await admin
    .getByRole("button", {
      name: "删除来自要删除的测试留言的留言",
      exact: true,
    })
    .click();
  await admin.getByRole("button", { name: "确认删除", exact: true }).click();
  await admin.waitForFunction(
    () => document.querySelectorAll(".inbox-message").length === 1,
  );
  await admin.keyboard.press("Escape");
  check(
    "管理员留言箱能读取私密内容、标为已读和删除，留言中的标记作为普通文字显示",
  );

  await admin.getByRole("button", { name: "编辑页面", exact: true }).click();
  await admin
    .getByLabel("编辑首页标题", { exact: true })
    .fill("草稿里的好奇心");
  const publicOriginal = (await (await fetch(`${base}/api/home`)).json())
    .content.profile.headline;
  assert.notEqual(publicOriginal, "草稿里的好奇心");
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "取消", exact: true }).click();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  assert.equal(await admin.locator("h1").innerText(), publicOriginal);
  check("就地编辑保持草稿，取消恢复公开内容");
  await admin.getByRole("button", { name: "编辑页面", exact: true }).click();
  await admin
    .getByLabel("编辑首页描述", { exact: true })
    .fill("栏目切换中的草稿");
  for (const [name, editName] of [
    ["项目", "编辑项目"],
    ["文字", "编辑文章"],
    ["相册", "编辑相册"],
    ["收集", "编辑收集"],
  ]) {
    await admin
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    await admin.getByRole("button", { name: editName, exact: true }).click();
    await admin
      .getByRole("button", { name: "返回首页预览", exact: true })
      .click();
  }
  await admin
    .getByRole("navigation")
    .getByRole("link", { name: "首页", exact: true })
    .click();
  assert.equal(
    await admin.getByLabel("编辑首页描述", { exact: true }).inputValue(),
    "栏目切换中的草稿",
  );
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "取消", exact: true }).click();
  check("管理员导航不被遮挡，各栏目可编辑且切换不丢草稿");

  await admin.getByRole("button", { name: "编辑页面", exact: true }).click();
  await admin
    .getByLabel("编辑首页标题", { exact: true })
    .fill("把好奇心，\n变成作品。");
  await admin
    .getByLabel("编辑首页描述", { exact: true })
    .fill("浏览器验收保存的内容");
  await admin.getByRole("button", { name: "编辑相册", exact: true }).click();
  await admin
    .getByRole("button", { name: "添加相册与首页照片", exact: true })
    .click();
  await admin.getByLabel("标题", { exact: true }).fill("浏览器上传的照片");
  await admin
    .getByLabel("上传照片", { exact: true })
    .setInputFiles(resolve("assets/demo/coffee.jpg"));
  await admin.getByText("图片已上传", { exact: true }).waitFor();
  await admin.getByLabel("拍摄地点", { exact: true }).fill("Local test");
  await admin.getByRole("button", { name: "上移内容", exact: true }).click();
  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  check("卡片编辑面板新增、图片上传和内容排序");
  await admin.getByRole("button", { name: "编辑项目", exact: true }).click();
  await admin.getByRole("button", { name: "添加项目", exact: true }).click();
  await admin.getByLabel("标题", { exact: true }).fill("新作品测试");
  await admin
    .getByLabel("项目链接", { exact: true })
    .fill("https://example.com/project");
  await admin.getByLabel("项目说明", { exact: true }).fill("可替换的项目说明");
  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  await admin.getByRole("button", { name: "编辑文章", exact: true }).click();
  await admin.getByRole("button", { name: "添加文章", exact: true }).click();
  await admin.getByLabel("标题", { exact: true }).fill("文章编辑测试");
  await admin.getByLabel("正文", { exact: true }).fill("前台输入的文章正文");
  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  await admin.getByRole("button", { name: "编辑收集", exact: true }).click();
  const collectionCount = await admin.locator(".editor-list>button").count();
  await admin.getByRole("button", { name: "添加收集", exact: true }).click();
  await admin.getByLabel("标题", { exact: true }).fill("稍后删除的收藏");
  await admin.getByLabel("分类", { exact: true }).selectOption("网站");
  await admin
    .getByLabel("来源链接", { exact: true })
    .fill("https://example.com/inspiration");
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "删除", exact: true }).click();
  assert.equal(
    await admin.locator(".editor-list>button").count(),
    collectionCount,
  );
  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  await admin.getByRole("button", { name: "编辑音乐", exact: true }).click();
  await admin.getByRole("button", { name: "添加音乐", exact: true }).click();
  await admin.getByLabel("标题", { exact: true }).fill("测试播放列表");
  await admin.getByLabel("艺术家", { exact: true }).fill("Original demo");
  await admin
    .getByLabel("上传音乐", { exact: true })
    .setInputFiles(resolve("assets/demo/cloud-notes.wav"));
  await admin.getByText("音频已上传", { exact: true }).waitFor();
  await admin.locator("svg.default-music-cover.editor-image").waitFor();
  const embeddedAudio = join(folder, "embedded-cover.mp3");
  await promisify(execFile)(createRequire(import.meta.url)("ffmpeg-static"), [
    "-nostdin",
    "-v",
    "error",
    "-i",
    resolve("assets/demo/cloud-notes.wav"),
    "-i",
    resolve("assets/demo/coffee.jpg"),
    "-map",
    "0:a:0",
    "-map",
    "1:v:0",
    "-t",
    "1",
    "-c:a",
    "libmp3lame",
    "-c:v",
    "copy",
    "-id3v2_version",
    "3",
    "-metadata:s:v",
    "comment=Cover (front)",
    "-y",
    embeddedAudio,
  ]);
  const uploadMusic = async (path) => {
    const response = admin.waitForResponse(
      (r) =>
        r.url().endsWith("/api/media?kind=audio") &&
        r.request().method() === "POST",
    );
    await admin.getByLabel("上传音乐", { exact: true }).setInputFiles(path);
    assert.equal((await response).status(), 201);
    await admin
      .getByLabel("上传音乐", { exact: true })
      .waitFor({ state: "attached" });
  };
  await uploadMusic(embeddedAudio);
  await admin.waitForFunction(
    () => document.querySelector("img.editor-image")?.naturalWidth > 0,
  );
  const embeddedPreview = await admin
    .locator("img.editor-image")
    .getAttribute("src");
  const manualResponse = admin.waitForResponse(
    (r) =>
      r.url().endsWith("/api/media?kind=image") &&
      r.request().method() === "POST",
  );
  await admin
    .getByLabel("上传音乐封面", { exact: true })
    .setInputFiles(resolve("assets/demo/poster.png"));
  const manualCoverId = (await (await manualResponse).json()).id;
  await admin.waitForFunction(
    (id) =>
      document
        .querySelector("img.editor-image")
        ?.getAttribute("src")
        .includes(id),
    manualCoverId,
  );
  assert.notEqual(
    await admin.locator("img.editor-image").getAttribute("src"),
    embeddedPreview,
  );
  await uploadMusic(resolve("assets/demo/cloud-notes.wav"));
  assert.ok(
    (await admin.locator("img.editor-image").getAttribute("src")).includes(
      manualCoverId,
    ),
  );
  await admin
    .getByRole("button", { name: "恢复自动封面", exact: true })
    .click();
  await admin.locator("svg.default-music-cover.editor-image").waitFor();
  await admin.screenshot({ path: join(artifacts, "music-editor.png") });
  await uploadMusic(embeddedAudio);
  await admin.waitForFunction(
    () => document.querySelector("img.editor-image")?.naturalWidth > 0,
  );
  await admin.screenshot({
    path: join(artifacts, "music-embedded-cover-editor.png"),
  });
  check("音乐编辑显示默认唱片和内嵌封面，自定义封面优先且可恢复自动读取");
  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "编辑个人资料", exact: true })
    .click();
  await admin
    .getByLabel("GitHub 链接", { exact: true })
    .fill("https://github.com/octocat");
  await admin
    .getByLabel("联系邮箱", { exact: true })
    .fill("local-qa@example.com");
  await admin
    .getByLabel("小红书主页链接", { exact: true })
    .fill("https://www.xiaohongshu.com/user/profile/local-qa");

  await admin
    .getByRole("button", { name: "返回首页预览", exact: true })
    .click();
  assert.equal(
    await admin
      .locator(".social-row a")
      .filter({ hasText: "Email" })
      .getAttribute("href"),
    "mailto:local-qa@example.com",
  );
  assert.equal(
    await admin.locator(".xiaohongshu-link").getAttribute("href"),
    "https://www.xiaohongshu.com/user/profile/local-qa",
  );
  check("项目和文章新增、收藏删除、音乐上传及社交链接编辑");

  await admin.route("**/api/home", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "测试服务暂不可用，草稿已保留。" }),
        })
      : route.continue(),
  );
  await admin.getByRole("button", { name: "保存修改", exact: true }).click();
  await admin
    .getByRole("alert")
    .filter({ hasText: "测试服务暂不可用" })
    .waitFor();
  assert.equal(
    await admin.getByLabel("编辑首页描述", { exact: true }).inputValue(),
    "浏览器验收保存的内容",
  );
  assert.notEqual(
    (await (await fetch(`${base}/api/home`)).json()).content.profile
      .description,
    "浏览器验收保存的内容",
  );
  await admin.screenshot({ path: join(artifacts, "editor-save-failure.png") });
  await admin.unroute("**/api/home");
  await admin.getByRole("button", { name: "保存修改", exact: true }).click();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  assert.equal(
    (await (await fetch(`${base}/api/home`)).json()).content.profile
      .description,
    "浏览器验收保存的内容",
  );
  assert.equal(
    (await (await fetch(`${base}/api/home`)).json()).content.social.xiaohongshu,
    "https://www.xiaohongshu.com/user/profile/local-qa",
  );
  check("保存失败不丢草稿，重试成功后才更新公开页面");
  await admin.getByRole("button", { name: "编辑页面", exact: true }).click();
  await admin
    .getByLabel("编辑首页描述", { exact: true })
    .fill("需要离开提醒的草稿");
  let warned = false;
  admin.once("dialog", async (d) => {
    warned = d.type() === "beforeunload";
    await d.dismiss();
  });
  await admin.reload({ timeout: 1500 }).catch(() => {});
  assert.ok(warned);
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "取消", exact: true }).click();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  check("未保存离开页面提醒");
  await admin.getByRole("button", { name: "编辑页面", exact: true }).click();
  await admin.getByLabel("编辑首页描述", { exact: true }).fill("旧窗口的草稿");
  const newer = await (await admin.request.get(`${base}/api/home`)).json();
  newer.content.profile.motto = "another window";
  assert.equal(
    (await admin.request.put(`${base}/api/home`, { data: newer })).status(),
    200,
  );
  await admin.getByRole("button", { name: "保存修改", exact: true }).click();
  await admin
    .getByRole("alert")
    .filter({ hasText: "另一个窗口已更新首页" })
    .waitFor();
  assert.equal(
    await admin.getByLabel("编辑首页描述", { exact: true }).inputValue(),
    "旧窗口的草稿",
  );
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "取消", exact: true }).click();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  check("多窗口版本冲突阻止覆盖并保留草稿");
  const beforeRestart = await (
    await admin.request.get(`${base}/api/home`)
  ).json();
  await stop();
  await start();
  await admin.reload();
  await admin.getByRole("button", { name: "编辑页面", exact: true }).waitFor();
  const afterRestart = await (
    await admin.request.get(`${base}/api/home`)
  ).json();
  assert.deepEqual(afterRestart, beforeRestart);
  await page.reload();
  await page.getByRole("button", { name: "今日已签到", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "取消喜欢", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  const persistedMessages = await (
    await admin.request.get(`${base}/api/messages`)
  ).json();
  assert.equal(persistedMessages.total, 1);
  assert.equal(
    persistedMessages.messages[0].email,
    "private-browser@example.com",
  );
  assert.equal(persistedMessages.messages[0].read, true);
  check("服务进程重启后内容、上传、会话、签到、点赞仍保留");
  await admin.getByRole("button", { name: "退出登录", exact: true }).click();
  await admin.waitForFunction(() => !document.querySelector(".admin-bar"));
  assert.equal(
    (
      await admin.request.put(`${base}/api/home`, { data: beforeRestart })
    ).status(),
    401,
  );
  check("退出登录后写入立即被拒绝");
  await page.route("**/api/weather", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"available":false}',
    }),
  );
  await page.reload();
  await page.getByText("天气暂不可用", { exact: true }).waitFor();
  check("天气失败清楚显示暂不可用");
  const home = await (await fetch(`${base}/api/home`)).json();
  const audioId = home.content.tracks[0].audioId;
  await page.route(`**/api/media/${audioId}`, (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.reload();
  await page.getByText("音乐暂时无法加载。", { exact: false }).waitFor();
  check("真实音频加载失败提示");
  await page.route("**/api/media/*", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.reload();
  await page.locator(".photo-card .image-fallback").waitFor();
  await page.locator(".music-card svg.default-music-cover").waitFor();
  await page
    .locator(".music-card")
    .screenshot({ path: join(artifacts, "music-default-cover.png") });
  assert.ok(
    (await page.locator(".photo-card .image-fallback").innerText()).includes(
      "图片暂不可用",
    ),
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "相册", exact: true })
    .click();
  await page.locator(".album-tile .image-fallback").first().waitFor();
  await page.locator(".album-tile").first().click();
  await page.locator(".photo-stage .image-fallback").waitFor();
  await navigate("首页");
  check("损坏图片在卡片与相册中都有回退状态");
  await page.unroute("**/api/media/*");
  await page.unroute(`**/api/media/${audioId}`);
  const empty = structuredClone(home);
  for (const k of ["projects", "articles", "photos", "collections", "tracks"])
    empty.content[k] = [];
  await page.route("**/api/home", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(empty),
    }),
  );
  await page.reload();
  await page.getByText("新的作品，正在慢慢生长。", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "播放音乐", exact: true })
      .isDisabled(),
    true,
  );
  await navigate("相册");
  await page
    .getByText("相册还空着，期待下一张喜欢的照片。", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".album-tile").count(), 0);
  await navigate("首页");
  check("空项目、文章、相册、收藏和音乐可正常展示");
  await page.unroute("**/api/home");
  await page.reload();
  await page.waitForSelector(".hero-card");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.className),
    "skip-link",
  );
  await page.keyboard.press("Enter");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "项目", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.locator(".section-projects").waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "文字", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.locator(".section-articles").waitFor();
  await page.getByRole("button", { name: "聊聊", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "聊聊",
  );
  check("导航支持键盘切换并聚焦正文，联系弹窗焦点圈定与恢复");
  assert.deepEqual(errors, [], "no unhandled browser runtime errors");
  check("无浏览器未捕获异常");
  await writeFile(
    join(artifacts, "browser-results.json"),
    JSON.stringify(
      { testedAt: new Date().toISOString(), checks, errors },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await stop();
  await rm(folder, { recursive: true, force: true });
}
