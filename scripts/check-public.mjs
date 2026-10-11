import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean);
const rules = [
  /\/(?:Users|home)\/[^\s"'<>/\\]+|[A-Z]:\\+Users\\+[^\s"'<>\\]+/i,
  /\b[a-z0-9.-]+\.(?:corp|internal|intranet)(?:\b|\.)/i,
  /\b(?:ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{30,}|sk-[a-zA-Z0-9]{20,})\b/,
];
let failed = false;
for (const path of paths) {
  const content = await readFile(path, "utf8");
  if (rules.some(rule => rule.test(path) || rule.test(content))) {
    console.error(`公开内容检查失败：${path}`);
    failed = true;
  }
}
// 提交身份只允许公开账号名称与 GitHub 隐私邮箱。
const name = execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim();
const email = execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim();
if (name !== "lolipop-1x1" || email !== "59793977+lolipop-1x1@users.noreply.github.com") {
  console.error("公开内容检查失败：Git 提交身份不符合隐私约定。");
  failed = true;
}
// 历史提交允许公开账号和自动更新工作流的官方机器人身份。
const identities = new Set([
  "lolipop-1x1 <59793977+lolipop-1x1@users.noreply.github.com>",
  "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
]);
const history = execFileSync("git", ["log", "--format=%an <%ae>%n%cn <%ce>"], { encoding: "utf8" }).trim().split("\n");
if (history.some(identity => !identities.has(identity))) {
  console.error("公开内容检查失败：历史提交身份不符合隐私约定。");
  failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`公开内容检查通过：${paths.length} 个文件；Git 使用公开账号与隐私邮箱。`);
