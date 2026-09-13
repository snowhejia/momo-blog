import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile,
  readdir,
  readFile,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import request from "supertest";
import sharp from "sharp";
import { openDatabase, readHome } from "../server/db";
import { createSiteAuth } from "../server/auth";
import { createApp } from "../server/app";
import { seed } from "../server/seed";
import { sydneyDay, type HomeResponse } from "../shared/model";
const exec = promisify(execFile);
const secret = "test-only-secret-which-is-at-least-32-characters";
const token = "isolated-integration-test-setup-token";
const origin = "http://127.0.0.1:4999";
test("独立数据库：首页、单管理员、素材、访客和持久化", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "hejia-api-"));
  const dbPath = join(folder, "site.db"),
    uploads = join(folder, "uploads");
  let db = openDatabase(dbPath);
  let instant = new Date("2026-10-03T13:59:59Z");
  const authOptions = {
    secret,
    setupToken: token,
    baseURL: origin,
    trustedOrigins: [origin],
    secure: false,
  };
  const makeApp = async () =>
    createApp(db, {
      auth: await createSiteAuth(db, authOptions),
      uploads,
      secret,
      now: () => instant,
      weather: async () => ({ available: false }),
    });
  await seed(db, uploads, resolve("assets/demo"));
  let app = await makeApp();
  let admin = request.agent(app);
  let guest = request.agent(app);
  let home: HomeResponse;
  try {
    await t.test(
      "公开读取，初始无管理员；匿名写入、上传和跨站请求被拒绝",
      async () => {
        home = (await guest.get("/api/home").expect(200)).body;
        assert.equal(home.revision, 1);
        assert.equal(home.content.profile.name, "Momo");
        assert.deepEqual(home.content.social, {
          github: "",
          email: "",
          xiaohongshu: "",
        });
        assert.equal(home.content.projects[0].id, "sample-project");
        assert.ok(home.content.profile.avatarId);
        assert.ok(home.content.photos.every((photo) => photo.demo));
        assert.ok(home.content.tracks.every((track) => track.demo));
        assert.ok(home.content.photos.length);
        const state = await guest.get("/api/state").expect(200);
        assert.equal(state.body.auth.initialized, false);
        assert.equal(state.body.stats.totalViews, 0);
        await guest.put("/api/home").send(home).expect(401);
        await guest
          .post("/api/media?kind=image")
          .attach("file", Buffer.from("bad"), "x.jpg")
          .expect(401);
        await guest
          .post("/api/checkin")
          .set("Origin", "https://attacker.invalid")
          .expect(403);
        await guest
          .post("/api/auth/sign-up/email")
          .send({
            email: "intruder@example.com",
            password: "password-password",
          })
          .expect(404);
      },
    );
    await t.test("首次初始化令牌校验、单管理员锁定与真实登录会话", async () => {
      await guest
        .post("/api/setup")
        .send({
          token: "not-the-real-test-token",
          email: "test@example.com",
          password: "test-password-123",
        })
        .expect(403);
      await admin
        .post("/api/setup")
        .set("Origin", origin)
        .send({
          token,
          email: "test@example.com",
          password: "test-password-123",
        })
        .expect(201);
      await guest
        .post("/api/setup")
        .send({
          token,
          email: "second@example.com",
          password: "test-password-123",
        })
        .expect(409);
      await admin
        .post("/api/auth/sign-in/email")
        .set("Origin", origin)
        .send({ email: "test@example.com", password: "test-password-123" })
        .expect(200);
      assert.equal(
        (await admin.get("/api/state")).body.auth.authenticated,
        true,
      );
      assert.equal(db.prepare("SELECT COUNT(*) n FROM user").get()!.n, 1);
    });
    await t.test(
      "小红书链接兼容旧内容，保存后可读取并拒绝危险链接",
      async () => {
        const original = db
          .prepare("SELECT data FROM site_content WHERE id=1")
          .get()!;
        const legacy = JSON.parse(String(original.data));
        delete legacy.social.xiaohongshu;
        db.prepare("UPDATE site_content SET data=? WHERE id=1").run(
          JSON.stringify(legacy),
        );
        assert.equal(
          (await guest.get("/api/home")).body.content.social.xiaohongshu,
          "",
        );
        db.prepare("UPDATE site_content SET data=? WHERE id=1").run(
          String(original.data),
        );
        const current = (await admin.get("/api/home")).body as HomeResponse;
        current.content.social.xiaohongshu = "javascript:alert(1)";
        await admin.put("/api/home").send(current).expect(400);
        current.content.social.xiaohongshu = "https://example.com/profile/demo";
        await guest.put("/api/home").send(current).expect(401);
        const saved = await admin.put("/api/home").send(current).expect(200);
        home = saved.body;
        assert.equal(
          (await guest.get("/api/home")).body.content.social.xiaohongshu,
          current.content.social.xiaohongshu,
        );
      },
    );
    await t.test("私人留言保存、去重、校验、频率限制及管理员管理", async () => {
      const message = {
        submissionId: randomUUID(),
        name: "访客 <b>hello</b>",
        email: "private-only@example.com",
        body: "这是仅给站主的留言。\n第二行文字。",
        website: "",
      };
      await guest.get("/api/messages").expect(401);
      await guest
        .post("/api/messages")
        .set("Origin", "https://attacker.invalid")
        .send(message)
        .expect(403);
      await guest.post("/api/messages").send(message).expect(201);
      await guest.post("/api/messages").send(message).expect(200);
      await guest
        .post("/api/messages")
        .send({ ...message, body: "不能覆盖原来的留言" })
        .expect(409);
      let inbox = (await admin.get("/api/messages").expect(200)).body;
      assert.equal(inbox.total, 1);
      assert.equal(inbox.unread, 1);
      assert.equal(inbox.messages[0].body, message.body);
      assert.equal(inbox.messages[0].name, message.name);
      assert.equal(inbox.messages[0].visitor_id, undefined);
      assert.ok(
        !JSON.stringify((await guest.get("/api/home")).body).includes(
          message.email,
        ),
      );
      await guest
        .patch(`/api/messages/${message.submissionId}`)
        .send({ read: true })
        .expect(401);
      await guest.delete(`/api/messages/${message.submissionId}`).expect(401);
      await admin
        .patch(`/api/messages/${message.submissionId}`)
        .send({ read: true })
        .expect(200);
      assert.equal((await admin.get("/api/messages")).body.unread, 0);
      for (const bad of [
        { name: " " },
        { email: "bad" },
        { body: "x".repeat(2001) },
        { website: "bot.example" },
      ])
        await guest
          .post("/api/messages")
          .send({ ...message, submissionId: randomUUID(), ...bad })
          .expect(400);
      const anonymousEmail = {
        ...message,
        submissionId: randomUUID(),
        email: "",
      };
      await guest.post("/api/messages").send(anonymousEmail).expect(201);
      await guest.post("/api/messages").send(anonymousEmail).expect(200);
      await guest.post("/api/messages").send(anonymousEmail).expect(200);
      await guest
        .post("/api/messages")
        .send({ ...anonymousEmail, submissionId: randomUUID() })
        .expect(429);
      // Verify the inbox can reach later pages without exposing visitor identifiers.
      const visitorId = String(
        db
          .prepare("SELECT visitor_id FROM contact_messages WHERE id=?")
          .get(message.submissionId)!.visitor_id,
      );
      const extras = Array.from({ length: 20 }, () => randomUUID());
      for (const id of extras)
        db.prepare(
          "INSERT INTO contact_messages(id,visitor_id,name,email,body,created_at) VALUES(?,?,?,?,?,?)",
        ).run(id, visitorId, "分页测试", "", "测试留言", instant.toISOString());
      inbox = (await admin.get("/api/messages?page=2").expect(200)).body;
      assert.equal(inbox.messages.length, 2);
      assert.equal(inbox.total, 22);
      await admin.get("/api/messages?page=-1").expect(400);
      for (const id of [...extras, anonymousEmail.submissionId])
        await admin.delete(`/api/messages/${id}`).expect(200);
      assert.equal((await admin.get("/api/messages")).body.total, 1);
    });
    await t.test(
      "访客按浏览器去重，访问按加载计数，管理员访问不计数",
      async () => {
        const pageViewId = randomUUID();
        let result = await guest
          .post("/api/visits")
          .send({ pageViewId })
          .expect(200);
        assert.equal(result.body.todayVisitors, 1);
        assert.equal(result.body.totalViews, 1);
        result = await guest
          .post("/api/visits")
          .send({ pageViewId })
          .expect(200);
        assert.equal(result.body.totalViews, 1);
        result = await guest
          .post("/api/visits")
          .send({ pageViewId: randomUUID() })
          .expect(200);
        assert.equal(result.body.totalViews, 2);
        assert.equal(result.body.todayVisitors, 1);
        result = await admin
          .post("/api/visits")
          .send({ pageViewId: randomUUID() })
          .expect(200);
        assert.equal(result.body.totalViews, 2);
        result = await request(app)
          .post("/api/visits")
          .send({ pageViewId: randomUUID() })
          .expect(200);
        assert.equal(result.body.todayVisitors, 2);
        assert.equal(result.body.totalViews, 3);
      },
    );
    await t.test(
      "悉尼日期跨午夜再次签到，同一天不重复；点赞可持久化与撤销",
      async () => {
        assert.equal(sydneyDay(instant), "2026-10-03");
        const first = await guest.post("/api/checkin").expect(200);
        assert.equal(first.body.checkins, 1);
        assert.equal(first.body.checkedIn, true);
        assert.equal((await guest.post("/api/checkin")).body.checkins, 1);
        instant = new Date("2026-10-03T14:00:01Z");
        assert.equal(sydneyDay(instant), "2026-10-04");
        assert.equal((await guest.get("/api/stats")).body.checkedIn, false);
        assert.equal((await guest.post("/api/checkin")).body.checkins, 2);
        let result = await guest
          .post("/api/likes")
          .send({ liked: true })
          .expect(200);
        assert.equal(result.body.likeCount, 1);
        assert.equal(result.body.liked, true);
        assert.equal(
          (await guest.post("/api/likes").send({ liked: true })).body.likeCount,
          1,
        );
        result = await guest
          .post("/api/likes")
          .send({ liked: false })
          .expect(200);
        assert.equal(result.body.likeCount, 0);
        await guest.post("/api/likes").send({ liked: true }).expect(200);
      },
    );
    await t.test(
      "图片实际格式与解码校验，未发布素材仅管理员可见，发布后可访问",
      async () => {
        await admin
          .post("/api/media?kind=image")
          .attach("file", Buffer.from("not an image"), "fake.png")
          .expect(400);
        const badJpeg = Buffer.from([
          255,
          216,
          255,
          224,
          0,
          16,
          ...Buffer.from("JFIF"),
          ...Array(40).fill(0),
        ]);
        await admin
          .post("/api/media?kind=image")
          .attach("file", badJpeg, "broken.jpg")
          .expect(400);
        for (const format of ["jpeg", "png", "webp"] as const) {
          const image = await sharp({
            create: {
              width: 80,
              height: 50,
              channels: 3,
              background: "#d4f36e",
            },
          })
            [format]()
            .toBuffer();
          const up = await admin
            .post("/api/media?kind=image")
            .attach("file", image, `actual.${format}`)
            .expect(201);
          const id = up.body.id;
          await guest.get(`/api/media/${id}`).expect(404);
          await admin
            .get(`/api/media/${id}`)
            .expect(200)
            .expect("Content-Type", /image\/webp/);
          home = (await admin.get("/api/home")).body;
          home.content.photos.push({
            id: randomUUID(),
            mediaId: id,
            title: format,
            caption: "测试上传",
            location: "",
            source: "测试",
            demo: true,
          });
          home = (await admin.put("/api/home").send(home).expect(200)).body;
          await guest.get(`/api/media/${id}?size=thumb`).expect(200);
        }
        assert.deepEqual(await readdir(join(uploads, "incoming")), []);
      },
    );
    await t.test(
      "MP3、M4A、WAV 解码、M4A MIME 与音频范围请求；拒绝伪造文件",
      async () => {
        const ffmpeg = createRequire(import.meta.url)("ffmpeg-static");
        assert.ok(ffmpeg);
        for (const ext of ["mp3", "m4a", "wav"]) {
          const file = join(folder, `tone.${ext}`);
          await exec(ffmpeg, [
            "-nostdin",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.4",
            "-y",
            file,
          ]);
          const up = await admin
            .post("/api/media?kind=audio")
            .attach("file", file)
            .expect(201);
          assert.ok(up.body.duration > 0);
          await admin.get(`/api/media/${up.body.id}?size=thumb`).expect(404);
          assert.equal(
            db.prepare("SELECT thumb FROM media WHERE id=?").get(up.body.id)!
              .thumb,
            "",
          );
          await admin
            .get(`/api/media/${up.body.id}`)
            .set("Range", "bytes=0-63")
            .expect(206)
            .expect("Content-Length", "64");
          home = (await admin.get("/api/home")).body;
          home.content.tracks.push({
            id: randomUUID(),
            audioId: up.body.id,
            title: ext,
            artist: "QA",
            coverId: null,
            demo: true,
            source: "生成测试音频",
          });
          home = (await admin.put("/api/home").send(home).expect(200)).body;
          await guest
            .get(`/api/media/${up.body.id}`)
            .expect(200)
            .expect(
              "Content-Type",
              ext === "m4a"
                ? "audio/mp4"
                : ext === "mp3"
                  ? "audio/mpeg"
                  : "audio/wav",
            );
        }
        await admin
          .post("/api/media?kind=audio")
          .attach("file", Buffer.from("a renamed text file"), "fake.m4a")
          .expect(400);
        const png = await sharp({
          create: { width: 8, height: 8, channels: 3, background: "#fff" },
        })
          .png()
          .toBuffer();
        await admin
          .post("/api/media?kind=audio")
          .attach("file", png, "renamed.mp3")
          .expect(400);
      },
    );
    await t.test(
      "音乐自动提取封面、旧文件补读、私有权限与损坏封面回退",
      async () => {
        const ffmpeg = createRequire(import.meta.url)("ffmpeg-static");
        const picture = join(folder, "embedded-cover.png");
        await sharp({
          create: {
            width: 1000,
            height: 1200,
            channels: 3,
            background: "#d4f36e",
          },
        })
          .png()
          .toFile(picture);
        for (const ext of ["mp3", "m4a"]) {
          const file = join(folder, `with-cover.${ext}`);
          await exec(ffmpeg, [
            "-nostdin",
            "-v",
            "error",
            "-i",
            join(folder, `tone.${ext}`),
            "-i",
            picture,
            "-map",
            "0:a:0",
            "-map",
            "1:v:0",
            "-c:a",
            "copy",
            "-c:v",
            "png",
            "-disposition:v:0",
            "attached_pic",
            ...(ext === "mp3"
              ? [
                  "-id3v2_version",
                  "3",
                  "-metadata:s:v",
                  "comment=Cover (front)",
                ]
              : []),
            "-y",
            file,
          ]);
          const up = await admin
            .post("/api/media?kind=audio")
            .attach("file", file)
            .expect(201);
          const coverURL = `/api/media/${up.body.id}?size=thumb`;
          await guest.get(coverURL).expect(404);
          const cover = await admin
            .get(coverURL)
            .expect(200)
            .expect("Content-Type", "image/webp");
          const meta = await sharp(cover.body).metadata();
          assert.equal(meta.height, 800);
          assert.equal(meta.format, "webp");
          home = (await admin.get("/api/home")).body;
          home.content.tracks.push({
            id: randomUUID(),
            title: `embedded ${ext}`,
            artist: "QA",
            audioId: up.body.id,
            coverId: null,
            demo: true,
            source: "测试内嵌封面",
          });
          home = (await admin.put("/api/home").send(home).expect(200)).body;
          await guest.get(coverURL).expect(200);
          // Older audio rows have NULL thumbnails; first access backfills without editing content.
          const row = db
            .prepare("SELECT thumb FROM media WHERE id=?")
            .get(up.body.id)!;
          await unlink(join(uploads, String(row.thumb)));
          db.prepare("UPDATE media SET thumb=NULL WHERE id=?").run(up.body.id);
          await Promise.all([
            guest.get(coverURL).expect(200),
            guest.get(coverURL).expect(200),
          ]);
          assert.equal(readHome(db).revision, home.revision);
          assert.equal(
            db.prepare("SELECT thumb FROM media WHERE id=?").get(up.body.id)!
              .thumb,
            row.thumb,
          );
          await guest
            .get(`/api/media/${up.body.id}`)
            .set("Range", "bytes=0-63")
            .expect(206);
        }
        // A malformed APIC image should not prevent a valid audio stream from playing.
        const mp3 = await readFile(join(folder, "tone.mp3"));
        const offset =
          mp3.toString("ascii", 0, 3) === "ID3"
            ? 10 +
              (((mp3[6] & 127) << 21) |
                ((mp3[7] & 127) << 14) |
                ((mp3[8] & 127) << 7) |
                (mp3[9] & 127))
            : 0;
        const payload = Buffer.concat([
          Buffer.from([0]),
          Buffer.from("image/png\0"),
          Buffer.from([3, 0]),
          Buffer.from("broken picture"),
        ]);
        const frame = Buffer.alloc(10);
        frame.write("APIC");
        frame.writeUInt32BE(payload.length, 4);
        const tag = Buffer.concat([frame, payload]);
        const header = Buffer.from([73, 68, 51, 3, 0, 0, 0, 0, 0, 0]);
        for (let i = 0; i < 4; i++)
          header[9 - i] = (tag.length >>> (7 * i)) & 127;
        const up = await admin
          .post("/api/media?kind=audio")
          .attach(
            "file",
            Buffer.concat([header, tag, mp3.subarray(offset)]),
            "broken-cover.mp3",
          )
          .expect(201);
        await admin.get(`/api/media/${up.body.id}?size=thumb`).expect(404);
        await admin
          .get(`/api/media/${up.body.id}`)
          .set("Range", "bytes=0-63")
          .expect(206);
      },
    );
    await t.test("完整内容保存、版本冲突与校验失败不影响公开内容", async () => {
      home = (await admin.get("/api/home")).body;
      const original = structuredClone(home);
      home.content.profile.headline = "经过验证的首页";
      home = (await admin.put("/api/home").send(home).expect(200)).body;
      assert.equal(home.revision, original.revision + 1);
      original.content.profile.headline = "过期窗口";
      await admin.put("/api/home").send(original).expect(409);
      assert.equal(
        (await guest.get("/api/home")).body.content.profile.headline,
        "经过验证的首页",
      );
      const invalid = structuredClone(home);
      invalid.content.projects[0].url = "javascript:alert(1)";
      await admin.put("/api/home").send(invalid).expect(400);
      const wrongKind = structuredClone(home);
      wrongKind.content.photos[0].mediaId = wrongKind.content.tracks[0].audioId;
      await admin.put("/api/home").send(wrongKind).expect(400);
      assert.equal((await guest.get("/api/home")).body.revision, home.revision);
    });
    await t.test(
      "数据库重新打开后内容、媒体、会话、签到和点赞保留",
      async () => {
        const count = Number(
            db.prepare("SELECT COUNT(*) n FROM checkins").get()!.n,
          ),
          likes = Number(db.prepare("SELECT COUNT(*) n FROM likes").get()!.n),
          rev = readHome(db).revision;
        const authCookie = (
          await admin
            .post("/api/auth/sign-in/email")
            .set("Origin", origin)
            .send({ email: "test@example.com", password: "test-password-123" })
            .expect(200)
        ).headers["set-cookie"];
        db.close();
        db = openDatabase(dbPath);
        await seed(db, uploads, resolve("assets/demo"));
        app = await makeApp();
        assert.equal(readHome(db).revision, rev);
        assert.equal(readHome(db).content.profile.headline, "经过验证的首页");
        assert.equal(
          Number(db.prepare("SELECT COUNT(*) n FROM checkins").get()!.n),
          count,
        );
        assert.equal(
          Number(db.prepare("SELECT COUNT(*) n FROM likes").get()!.n),
          likes,
        );
        const cookie = (Array.isArray(authCookie) ? authCookie : [authCookie])
          .filter(Boolean)
          .map((s: string) => s.split(";")[0])
          .join("; ");
        assert.equal(
          (await request(app).get("/api/state").set("Cookie", cookie)).body.auth
            .authenticated,
          true,
        );
        const inbox = (
          await request(app)
            .get("/api/messages")
            .set("Cookie", cookie)
            .expect(200)
        ).body;
        assert.equal(inbox.total, 1);
        assert.equal(inbox.messages[0].email, "private-only@example.com");
        assert.equal(inbox.messages[0].read, true);
        await request(app)
          .get(`/api/media/${readHome(db).content.photos[0].mediaId}`)
          .expect(200);
        const coveredTrack = readHome(db).content.tracks.find(
          (track) => track.title === "embedded mp3",
        )!;
        await request(app)
          .get(`/api/media/${coveredTrack.audioId}?size=thumb`)
          .expect(200)
          .expect("Content-Type", "image/webp");
        await request(app)
          .post("/api/auth/sign-out")
          .set("Origin", origin)
          .set("Cookie", cookie)
          .send({})
          .expect(200);
        await request(app)
          .put("/api/home")
          .set("Cookie", cookie)
          .send(readHome(db))
          .expect(401);
      },
    );
    await t.test("空内容可保存并读回，天气故障明确返回不可用", async () => {
      admin = request.agent(app);
      await admin
        .post("/api/auth/sign-in/email")
        .set("Origin", origin)
        .send({ email: "test@example.com", password: "test-password-123" })
        .expect(200);
      home = (await admin.get("/api/home")).body;
      home.content.projects = [];
      home.content.articles = [];
      home.content.photos = [];
      home.content.collections = [];
      home.content.tracks = [];
      const result = await admin.put("/api/home").send(home).expect(200);
      assert.deepEqual(result.body.content.photos, []);
      assert.deepEqual((await request(app).get("/api/weather")).body, {
        available: false,
      });
    });
  } finally {
    db.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("悉尼时区正确处理夏令时切换与午夜", () => {
  assert.equal(sydneyDay(new Date("2026-01-01T13:30:00Z")), "2026-01-02");
  assert.equal(sydneyDay(new Date("2026-07-01T13:30:00Z")), "2026-07-01");
  assert.equal(sydneyDay(new Date("2026-10-03T15:59:59Z")), "2026-10-04");
  assert.equal(sydneyDay(new Date("2026-10-03T16:00:00Z")), "2026-10-04");
});
