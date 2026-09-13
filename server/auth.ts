import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

export interface AuthOptions {
  secret: string;
  setupToken: string;
  baseURL: string;
  trustedOrigins: string[];
  secure: boolean;
}
export async function createSiteAuth(db: DatabaseSync, options: AuthOptions) {
  const config = {
    database: db,
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    telemetry: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: options.secure,
      cookiePrefix: "hejia-homepage",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" as const },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
  };
  const migrations = await getMigrations(config);
  await migrations.runMigrations();
  const auth = betterAuth(config);
  // Even concurrent initialization requests cannot create a second account.
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS single_site_admin ON "user" ((1));',
  );
  const bootstrap = betterAuth({
    ...config,
    emailAndPassword: { ...config.emailAndPassword, disableSignUp: false },
  });
  const initialized = () => !!db.prepare('SELECT id FROM "user" LIMIT 1').get();
  const session = async (req: Request) =>
    auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const requireAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const data = await session(req);
    const admin = db.prepare('SELECT id FROM "user" LIMIT 1').get();
    if (!data || !admin || data.user.id !== admin.id) {
      res.status(401).json({ error: "登录已过期，请重新登录。" });
      return;
    }
    res.locals.admin = data.user;
    next();
  };
  const originGuard = (req: Request, res: Response, next: NextFunction) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["sec-fetch-site"] === "cross-site" ||
        (req.headers.origin &&
          !options.trustedOrigins.includes(req.headers.origin)))
    ) {
      res.status(403).json({ error: "请求来源无效。" });
      return;
    }
    next();
  };
  let initializing = false;
  function mount(app: Express) {
    app.use(
      "/api/auth",
      rateLimit({
        windowMs: 60_000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "登录尝试过于频繁，请一分钟后再试。" },
      }),
    );
    app.all(
      "/api/auth/*splat",
      (req, res, next) => {
        const endpoint = req.path.slice("/api/auth/".length);
        if (!["sign-in/email", "get-session", "sign-out"].includes(endpoint)) {
          res.status(404).json({ error: "此认证入口未开放。" });
          return;
        }
        next();
      },
      originGuard,
      toNodeHandler(auth),
    );
    app.use(express.json({ limit: "2mb" }));
    app.get("/api/admin/status", async (req, res) => {
      const data = await session(req);
      res.json({
        initialized: initialized(),
        authenticated: !!data,
        ...(data ? { email: data.user.email } : {}),
      });
    });
    app.post(
      "/api/setup",
      rateLimit({
        windowMs: 60_000,
        limit: 5,
        message: { error: "初始化尝试过于频繁，请稍后重试。" },
      }),
      originGuard,
      async (req, res) => {
        if (initialized() || initializing) {
          res.status(409).json({ error: "管理员已创建，初始化入口已关闭。" });
          return;
        }
        const input = z
          .object({
            token: z.string().min(20).max(256),
            email: z.email(),
            password: z.string().min(12).max(128),
          })
          .safeParse(req.body);
        if (!input.success) {
          res
            .status(400)
            .json({ error: "请填写有效邮箱、初始化令牌和至少 12 位密码。" });
          return;
        }
        const actual = Buffer.from(input.data.token);
        const expected = Buffer.from(options.setupToken);
        if (
          !expected.length ||
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)
        ) {
          res.status(403).json({ error: "初始化令牌不正确。" });
          return;
        }
        initializing = true;
        try {
          await bootstrap.api.signUpEmail({
            body: {
              email: input.data.email,
              password: input.data.password,
              name: "Site Admin",
            },
          });
          res.status(201).json({ ok: true });
        } catch {
          res.status(400).json({ error: "创建失败，请检查资料后重试。" });
        } finally {
          initializing = false;
        }
      },
    );
  }
  return { auth, mount, requireAdmin, originGuard, session, initialized };
}
export type SiteAuth = Awaited<ReturnType<typeof createSiteAuth>>;
