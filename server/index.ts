import { resolve, join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { openDatabase } from "./db.js";
import { createSiteAuth } from "./auth.js";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
const dataDir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
function localSecret(name: string) {
  const file = join(dataDir, name);
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  return readFileSync(file, "utf8").trim();
}
const port = Number(process.env.PORT) || 4318;
const baseURL = process.env.APP_URL || `http://127.0.0.1:${port}`;
const secure = new URL(baseURL).protocol === "https:";
const secret = process.env.AUTH_SECRET || localSecret(".auth-secret");
const db = openDatabase(join(dataDir, "site.db"));
const uploads = join(dataDir, "uploads");
const auth = await createSiteAuth(db, {
  secret,
  setupToken: process.env.SETUP_TOKEN || localSecret("setup-token.txt"),
  baseURL,
  trustedOrigins: [
    new URL(baseURL).origin,
    ...(!secure
      ? [
          "http://127.0.0.1:4317",
          "http://localhost:4317",
          `http://127.0.0.1:${port}`,
          `http://localhost:${port}`,
        ]
      : []),
  ],
  secure,
});
await seed(db, uploads, resolve("assets/demo"));
const app = createApp(db, {
  auth,
  uploads,
  secret,
  secure,
  // Railway terminates HTTPS at its edge and forwards to this container.
  trustProxy: secure ? 1 : false,
  staticDir: resolve("dist/client"),
});
const server = app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Homepage: http://${process.env.HOST || "127.0.0.1"}:${port}\n首次创建管理员时，请使用 data/setup-token.txt 中的本地初始化令牌。`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
