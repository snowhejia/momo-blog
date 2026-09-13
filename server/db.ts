import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { HomeContent, HomeResponse } from "../shared/model.js";
export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,kind TEXT NOT NULL,filename TEXT NOT NULL,thumb TEXT,mime TEXT NOT NULL,width INTEGER,height INTEGER,duration REAL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY,visitor_id TEXT NOT NULL REFERENCES visitors(id),day TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS visit_day_visitor ON visits(day,visitor_id);
CREATE TABLE IF NOT EXISTS checkins (visitor_id TEXT NOT NULL REFERENCES visitors(id),day TEXT NOT NULL,PRIMARY KEY(visitor_id,day));
CREATE TABLE IF NOT EXISTS likes (visitor_id TEXT PRIMARY KEY REFERENCES visitors(id));
CREATE TABLE IF NOT EXISTS contact_messages (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL REFERENCES visitors(id), name TEXT NOT NULL, email TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at DESC,id DESC);`);
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(
    "startedAt",
    new Date().toISOString(),
  );
  return db;
}
export function readHome(db: DatabaseSync): HomeResponse {
  const row = db
    .prepare("SELECT revision,data FROM site_content WHERE id=1")
    .get();
  if (!row) throw new Error("首页尚未初始化");
  const content = JSON.parse(String(row.data)) as HomeContent;
  content.profile.avatarId ??= null;
  content.social.xiaohongshu ??= "";
  return { revision: Number(row.revision), content };
}
