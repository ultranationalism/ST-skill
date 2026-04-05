#!/usr/bin/env bun
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
  st-preview - SillyTavern 角色卡预览工具

  用法:
    bun run preview <card.json|card.png> [--port 3000] [--mode auto|data|frontend]
    npx tsx src/cli.ts <card.json|card.png> [--port 3000]

  选项:
    --port, -p    指定端口号 (默认: 3000)
    --mode, -m    预览模式: auto(自动检测), data(数据视图), frontend(前端渲染) (默认: auto)
    --no-open     不自动打开浏览器
    --help, -h    显示帮助
  `);
  process.exit(0);
}

// Parse arguments
const cardPath = resolve(args.find((a) => !a.startsWith("-"))!);
const portIdx = args.findIndex((a) => a === "--port" || a === "-p");
const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3000;
const modeIdx = args.findIndex((a) => a === "--mode" || a === "-m");
const modeArg = modeIdx !== -1 ? args[modeIdx + 1] : "auto";
const noOpen = args.includes("--no-open");

if (!existsSync(cardPath)) {
  console.error(`错误: 文件不存在 - ${cardPath}`);
  process.exit(1);
}

// Read card data - support both JSON and PNG
let cardData: string;
const ext = extname(cardPath).toLowerCase();

if (ext === ".png") {
  cardData = extractFromPng(cardPath);
} else {
  try {
    cardData = readFileSync(cardPath, "utf-8");
    JSON.parse(cardData);
  } catch (e) {
    console.error(`错误: 无法解析 JSON - ${(e as Error).message}`);
    process.exit(1);
  }
}

const card = JSON.parse(cardData);
const data = card.data || card;

// Detect card type
const cardType = detectCardType(data);
const mode = modeArg === "auto" ? (cardType === "fullfront" ? "frontend" : "data") : modeArg;

// Extract frontend HTML if applicable
let frontendHtml: string | null = null;
if (cardType === "fullfront") {
  frontendHtml = extractFrontendHtml(data);
}

// Extract first_mes HTML (cover page)
let firstMesHtml: string | null = null;
if (data.first_mes) {
  firstMesHtml = extractHtmlContent(data.first_mes);
}

// Read HTML templates
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const templatePath = resolve(__dirname, "template.html");
const template = readFileSync(templatePath, "utf-8");

// Inject card data into data template
const dataHtml = template.replace(
  "/*__CARD_DATA__*/",
  `const CARD_DATA = ${JSON.stringify(data)};\nconst CARD_TYPE = ${JSON.stringify(cardType)};\nconst FRONTEND_HTML = ${JSON.stringify(frontendHtml)};`
);

// Start server
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    if (mode === "frontend" && firstMesHtml) {
      // Default to first_mes (cover page) for fullfront cards
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(firstMesHtml);
    } else if (mode === "frontend" && frontendHtml) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(frontendHtml);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(dataHtml);
    }
  } else if (url.pathname === "/cover" && firstMesHtml) {
    // first_mes cover page
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(firstMesHtml);
  } else if (url.pathname === "/data") {
    // Always serve data view
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dataHtml);
  } else if (url.pathname === "/frontend" && frontendHtml) {
    // Always serve frontend view (game UI)
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(frontendHtml);
  } else if (url.pathname === "/api/card") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  const typeLabel = cardType === "fullfront" ? "完全前端卡" : cardType === "embedded" ? "前端嵌入卡" : "基础卡";
  console.log(`\n  🎴 角色卡预览: ${basename(cardPath)}`);
  console.log(`  📋 类型: ${typeLabel}`);
  if (cardType === "fullfront") {
    console.log(`  📡 ${url} (封面页)`);
    console.log(`  🖥️  游戏界面: ${url}/frontend`);
    if (firstMesHtml) console.log(`  🎭 封面页: ${url}/cover`);
    console.log(`  📊 数据视图: ${url}/data`);
  } else {
    console.log(`  📡 ${url} (${mode === "frontend" ? "前端视图" : "数据视图"})`);
  }
  console.log();

  if (!noOpen) {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${cmd} ${url}`);
  }
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

// --- Utility functions ---

function extractFromPng(pngPath: string): string {
  const buf = readFileSync(pngPath);
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.subarray(0, 8).compare(PNG_SIG) !== 0) {
    console.error("Not a valid PNG file");
    process.exit(1);
  }

  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");

    if (type === "tEXt") {
      const chunkData = buf.subarray(offset + 8, offset + 8 + length);
      const nullIdx = chunkData.indexOf(0);
      const keyword = chunkData.subarray(0, nullIdx).toString("ascii");
      const value = chunkData.subarray(nullIdx + 1).toString("ascii");

      if (keyword === "chara") {
        const json = Buffer.from(value, "base64").toString("utf-8");
        JSON.parse(json); // validate
        return json;
      }
    }
    offset += 12 + length;
  }

  console.error("No 'chara' tEXt chunk found in PNG");
  process.exit(1);
}

function extractHtmlContent(text: string): string | null {
  if (!text) return null;

  // Extract from ```html code block (greedy — JS inside may contain backticks)
  const codeBlockMatch = text.match(/```html\s*\n([\s\S]*)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1];
    if (inner.includes("<!DOCTYPE html") || inner.includes("<html")) return inner;
    // Fragment — wrap it
    return `<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="UTF-8"></head>\n<body style="margin:0;padding:0;background:#1a1210;">\n${inner}\n</body></html>`;
  }

  // Raw HTML document
  if (text.includes("<!DOCTYPE html")) {
    const htmlStart = text.indexOf("<!DOCTYPE html");
    const htmlEnd = text.lastIndexOf("</html>");
    if (htmlEnd !== -1) return text.substring(htmlStart, htmlEnd + 7);
  }

  // HTML fragment with meaningful content
  if (text.includes("<style>") && text.length > 300) {
    return `<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="UTF-8"></head>\n<body style="margin:0;padding:0;background:#1a1210;">\n${text}\n</body></html>`;
  }

  return null;
}

function detectCardType(data: any): "fullfront" | "embedded" | "basic" {
  const regexScripts = data.extensions?.regex_scripts || [];

  // Check for full frontend card: regex replaceString contains a full HTML document or large HTML fragment
  for (const r of regexScripts) {
    if (r.replaceString && r.replaceString.length > 10000) {
      if (r.replaceString.includes("<!DOCTYPE html") || r.replaceString.includes("<script>")) {
        return "fullfront";
      }
    }
  }

  // Check for embedded card: has tavern_helper scripts or MVU-related worldbook entries
  const th = data.extensions?.tavern_helper;
  if (th?.scripts?.length > 0) return "embedded";

  const entries = data.character_book?.entries || [];
  for (const e of entries) {
    const name = (e.comment || e.name || "").toLowerCase();
    if (name.includes("initvar") || name.includes("mvu") || name.includes("statusplaceholder")) {
      return "embedded";
    }
    if (e.content && e.content.includes("<StatusPlaceHolderImpl/>")) {
      return "embedded";
    }
  }

  return "basic";
}

function extractFrontendHtml(data: any): string | null {
  const regexScripts = data.extensions?.regex_scripts || [];

  for (const r of regexScripts) {
    if (!r.replaceString || r.replaceString.length < 5000) continue;
    const html = extractHtmlContent(r.replaceString);
    if (html) return html;
  }

  return null;
}
