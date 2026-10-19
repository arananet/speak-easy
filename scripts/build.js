#!/usr/bin/env node
// Inlines the frontend files into the worker template -> dist/worker.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const replacements = {
  __APP_HTML__: JSON.stringify(read("src/frontend/index.html")),
  __APP_JS__: JSON.stringify(read("src/frontend/app.js")),
  __APP_CSS__: JSON.stringify(read("src/frontend/styles.css")),
  __PHRASES_JSON__: JSON.stringify(read("src/frontend/phrases.json")),
};

let worker = read("src/worker.template.js");
for (const [key, value] of Object.entries(replacements)) {
  if (!worker.includes(key)) {
    console.error("placeholder missing in template: " + key);
    process.exit(1);
  }
  worker = worker.split(key).join(value);
}
if (/__APP_[A-Z]+__|__PHRASES_JSON__/.test(worker)) {
  console.error("unreplaced placeholders remain");
  process.exit(1);
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "worker.js"), worker);
console.log("built dist/worker.js");
