#!/usr/bin/env bun
/**
 * Extract character card JSON from a PNG file's tEXt chunks.
 * SillyTavern cards store base64-encoded JSON in a tEXt chunk keyed "chara".
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pngPath = resolve(process.argv[2] || "");
if (!pngPath || !pngPath.endsWith(".png")) {
  console.error("Usage: bun src/parse-png.ts <card.png> [output.json]");
  process.exit(1);
}

const buf = readFileSync(pngPath);

// PNG signature: 8 bytes
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (buf.subarray(0, 8).compare(PNG_SIG) !== 0) {
  console.error("Not a valid PNG file");
  process.exit(1);
}

let offset = 8;
let charaData: string | null = null;

while (offset < buf.length) {
  const length = buf.readUInt32BE(offset);
  const type = buf.subarray(offset + 4, offset + 8).toString("ascii");

  if (type === "tEXt") {
    const data = buf.subarray(offset + 8, offset + 8 + length);
    const nullIdx = data.indexOf(0);
    const keyword = data.subarray(0, nullIdx).toString("ascii");
    const value = data.subarray(nullIdx + 1).toString("ascii");

    if (keyword === "chara") {
      charaData = value;
      break;
    }
  }

  // Move to next chunk: length(4) + type(4) + data(length) + crc(4)
  offset += 12 + length;
}

if (!charaData) {
  console.error("No 'chara' tEXt chunk found in PNG");
  process.exit(1);
}

// Decode base64
const json = Buffer.from(charaData, "base64").toString("utf-8");

// Validate JSON
let parsed: any;
try {
  parsed = JSON.parse(json);
} catch {
  console.error("Failed to parse decoded JSON");
  // Write raw for debugging
  const rawOut = resolve(process.argv[3] || "card_raw.txt");
  writeFileSync(rawOut, json);
  console.log(`Raw data written to ${rawOut}`);
  process.exit(1);
}

// Output
const outPath = resolve(process.argv[3] || pngPath.replace(".png", ".json"));
writeFileSync(outPath, JSON.stringify(parsed, null, 2));
console.log(`Extracted card: ${parsed.data?.name || parsed.name || "unknown"}`);
console.log(`Output: ${outPath}`);

// Print summary
const data = parsed.data || parsed;
console.log(`\nSummary:`);
console.log(`  Name: ${data.name || "?"}`);
console.log(`  Creator: ${data.creator || "?"}`);
console.log(`  Description length: ${(data.description || "").length} chars`);
console.log(`  First messages: ${(data.first_mes ? 1 : 0) + (data.alternate_greetings?.length || 0)}`);
console.log(`  World book entries: ${data.character_book?.entries?.length || 0}`);
console.log(`  Regex scripts: ${data.extensions?.regex_scripts?.length || 0}`);

// Check for tavern_helper scripts
const th = data.extensions?.tavern_helper;
if (th) {
  console.log(`  Tavern Helper scripts: ${JSON.stringify(th.scripts?.length || 0)}`);
  console.log(`  Tavern Helper variables: ${Object.keys(th.variables || {}).length} keys`);
}
