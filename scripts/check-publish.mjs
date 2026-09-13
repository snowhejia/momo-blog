import { execFileSync } from "node:child_process";
import { extname } from "node:path";

// Inspect the Git index, not the live database or ignored local files.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
if (!files.length) throw new Error("请先将准备提交的源码加入 Git 暂存区。");
const blockedPath =
  /(^|\/)(data|uploads|backups|artifacts|node_modules|dist|coverage|playwright-report|test-results)(\/|$)|\.(db|sqlite3?)(-|$)|\.(pem|key|log)$|setup-token|\.DS_Store$/i;
const textTypes = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  ".json",
  ".md",
  ".css",
  ".html",
  ".svg",
  ".py",
  ".command",
  ".yml",
  ".yaml",
]);
const sensitiveText =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{50,}|\/Users\/[^/\s]+\/|\/var\/folders\//;
const errors = [];
for (const file of files) {
  if (
    blockedPath.test(file) ||
    (/(^|\/)\.env(?:\.|$)/.test(file) && file !== ".env.example")
  ) {
    errors.push(`${file}: 本地数据或私密配置不可提交`);
    continue;
  }
  if (
    file.startsWith("assets/profile/") &&
    !["assets/profile/avatar-demo.webp", "assets/profile/README.md"].includes(
      file,
    )
  ) {
    errors.push(`${file}: 只允许已批准的示例头像和来源说明`);
    continue;
  }
  const bytes = execFileSync("git", ["show", `:${file}`], {
    maxBuffer: 60 * 1024 * 1024,
  });
  if (bytes.subarray(0, 16).toString() === "SQLite format 3\0")
    errors.push(`${file}: 不可提交数据库`);
  if (
    (textTypes.has(extname(file)) || file === ".env.example") &&
    sensitiveText.test(bytes.toString("utf8"))
  )
    errors.push(`${file}: 检测到密钥或本机个人路径`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `检查通过：${files.length} 个待发布文件，不含数据库、上传目录、环境密钥或本机个人路径。`,
  );
