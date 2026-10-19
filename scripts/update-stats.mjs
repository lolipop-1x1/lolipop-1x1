import { mkdir, writeFile } from "node:fs/promises";

const owner = "lolipop-1x1";
const featured = ["agent-manor", "dsh-recap", "dsh-you-should-know", "CodePerimeter"];
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function get(path) {
  const response = await fetch(`https://api.github.com/${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${path}`);
  return response.json();
}

const user = await get(`users/${owner}`);
const repos = [];
for (let page = 1; ; page++) {
  const batch = await get(`users/${owner}/repos?per_page=100&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}
// 用户公开仓库接口不会读取私有项目；精选项目只按公开代码字节汇总。
const originals = repos.filter(repo => !repo.fork);
const languages = {};
for (const result of await Promise.all(featured.map(name => get(`repos/${owner}/${name}/languages`)))) {
  for (const [name, bytes] of Object.entries(result)) languages[name] = (languages[name] ?? 0) + bytes;
}
const ranked = Object.entries(languages).sort((a, b) => b[1] - a[1]);
const total = ranked.reduce((sum, [, bytes]) => sum + bytes, 0);
const groups = [...ranked.slice(0, 4), ["Other", ranked.slice(4).reduce((sum, [, bytes]) => sum + bytes, 0)]];
const date = new Date().toISOString().slice(0, 10);
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const colors = ["#5b9cf5", "#a78bfa", "#e6b85c", "#57b9b0", "#71839d"];
const themes = {
  dark: { background: "#0d1117", text: "#e6edf3", muted: "#9daec2", accent: "#79b8ff", border: "#30363d", soft: "#1b2b40" },
  light: { background: "#ffffff", text: "#1f2937", muted: "#52637a", accent: "#235ca8", border: "#d8dee8", soft: "#e7effa" },
};
await mkdir("assets", { recursive: true });
for (const [mode, theme] of Object.entries(themes)) {
  const text = (x, y, value, size = 12, fill = theme.text, weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
  const card = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="196" viewBox="0 0 440 196" role="img" aria-labelledby="title"><title id="title">${escape(title)}</title><rect x=".5" y=".5" width="439" height="195" rx="10" fill="${theme.background}" stroke="${theme.border}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">${text(22, 32, title, 17, theme.accent, 600)}${body}${text(22, 177, `Public data · ${date} UTC`, 10, theme.muted)}</g></svg>\n`;
  const metrics = [
    [repos.length, "Public repositories"],
    [originals.length, "Original repositories"],
    [originals.reduce((sum, repo) => sum + repo.stargazers_count, 0), "Stars on originals"],
    [user.followers, "Followers"],
  ];
  const profile = metrics.map(([value, label], index) => {
    const x = 22 + (index % 2) * 212;
    const y = index < 2 ? 69 : 124;
    return text(x, y, value, 26, theme.text, 600) + text(x, y + 19, label, 11, theme.muted);
  }).join("");
  await writeFile(`assets/profile-${mode}.svg`, card("Public GitHub", profile));

  let offset = 22;
  const bar = groups.map(([, bytes], index) => {
    const width = 396 * bytes / total;
    const part = `<rect x="${offset.toFixed(2)}" y="61" width="${width.toFixed(2)}" height="9" fill="${colors[index]}"/>`;
    offset += width;
    return part;
  }).join("");
  const legend = groups.map(([name, bytes], index) => {
    const x = 22 + (index % 2) * 212;
    const y = 98 + Math.floor(index / 2) * 24;
    return `<circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${colors[index]}"/>` + text(x + 15, y, `${name} ${(100 * bytes / total).toFixed(1)}%`, 12);
  }).join("");
  await writeFile(`assets/languages-${mode}.svg`, card("Languages in featured projects", text(22, 49, `Code bytes across ${featured.length} public repositories`, 10, theme.muted) + bar + legend));

  const labels = ["Conversation context", "Agent workflows", "Local observability"];
  const nodes = labels.map((label, index) => {
    const x = 73 + index * 147;
    return `<circle cx="${x}" cy="22" r="8" fill="${theme.soft}" stroke="${theme.accent}"/><circle cx="${x}" cy="22" r="2.5" fill="${theme.accent}"/>${text(x - (label.length * 3.5), 55, label, 13, theme.muted)}`;
  }).join("");
  const workflow = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="74" viewBox="0 0 440 74" role="img" aria-labelledby="title"><title id="title">Conversation context, agent workflows, local observability</title><style>@media(prefers-reduced-motion:reduce){.signal{display:none}}</style><path d="M73 22H367" stroke="${theme.border}" fill="none"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">${nodes}</g><circle class="signal" r="3" fill="${theme.accent}"><animateMotion dur="6s" repeatCount="indefinite" path="M73 22H367"/></circle></svg>\n`;
  await writeFile(`assets/workflow-${mode}.svg`, workflow);
}
console.log(`Updated public profile assets for ${owner}: ${repos.length} repositories, ${ranked.length} featured languages.`);
