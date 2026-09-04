const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".cjs", ".mjs"]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (extensions.has(path.extname(full))) files.push(full);
  }
  return files;
}

test("Arabic fathatan stays after final alif", () => {
  const bad = [];
  for (const file of walk("src")) {
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("\u064b\u0627")) bad.push(file);
  }
  assert.deepEqual(bad, []);
});

test("Arabic add-listing label is unified", () => {
  const dict = JSON.parse(fs.readFileSync("src/dictionaries/ar.json", "utf8"));
  assert.equal(dict.common.addListing, "أضف إعلاناً");
});
