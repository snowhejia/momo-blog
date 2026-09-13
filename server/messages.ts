import type express from "express";
import type { DatabaseSync } from "node:sqlite";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { messageSchema } from "../shared/model.js";
import type { SiteAuth } from "./auth.js";
import { HttpError } from "./media.js";

export function mountMessages(
  app: express.Express,
  db: DatabaseSync,
  auth: SiteAuth,
  visitor: (req: express.Request, res: express.Response) => string,
  now: () => Date,
) {
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "留言有点频繁，请稍后再试。" },
  });
  app.post("/api/messages", limit, (req, res) => {
    const input = messageSchema.safeParse(req.body);
    if (!input.success)
      throw new HttpError(
        400,
        input.error.issues[0]?.message || "请检查留言内容。",
      );
    const { submissionId, name, email, body } = input.data;
    const visitorId = visitor(req, res);
    const previous = db
      .prepare(
        "SELECT visitor_id,name,email,body FROM contact_messages WHERE id=?",
      )
      .get(submissionId);
    if (previous) {
      if (
        previous.visitor_id !== visitorId ||
        previous.name !== name ||
        previous.email !== email ||
        previous.body !== body
      )
        throw new HttpError(409, "这条留言已提交，请修改内容后重新发送。");
      res.json({ received: true });
      return;
    }
    db.prepare(
      "INSERT INTO contact_messages(id,visitor_id,name,email,body,created_at) VALUES(?,?,?,?,?,?)",
    ).run(submissionId, visitorId, name, email, body, now().toISOString());
    res.status(201).json({ received: true });
  });
  app.get("/api/messages", auth.requireAdmin, (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .safeParse(req.query.page || 1);
    if (!page.success) throw new HttpError(400, "页码无效。");
    const pageSize = 20;
    const rows = db
      .prepare(
        "SELECT id,name,email,body,created_at,is_read FROM contact_messages ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
      )
      .all(pageSize, (page.data - 1) * pageSize);
    res.json({
      messages: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        body: row.body,
        createdAt: row.created_at,
        read: Boolean(row.is_read),
      })),
      total: Number(
        db.prepare("SELECT COUNT(*) n FROM contact_messages").get()!.n,
      ),
      unread: Number(
        db
          .prepare("SELECT COUNT(*) n FROM contact_messages WHERE is_read=0")
          .get()!.n,
      ),
      page: page.data,
      pageSize,
    });
  });
  app.patch("/api/messages/:id", auth.requireAdmin, (req, res) => {
    const input = z.object({ read: z.boolean() }).safeParse(req.body);
    if (!input.success) throw new HttpError(400, "留言状态无效。");
    const result = db
      .prepare("UPDATE contact_messages SET is_read=? WHERE id=?")
      .run(Number(input.data.read), String(req.params.id));
    if (!result.changes) throw new HttpError(404, "这条留言已不存在。");
    res.json({ updated: true });
  });
  app.delete("/api/messages/:id", auth.requireAdmin, (req, res) => {
    db.prepare("DELETE FROM contact_messages WHERE id=?").run(
      String(req.params.id),
    );
    res.json({ deleted: true });
  });
}
