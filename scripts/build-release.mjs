import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const output = `dist/OFB-Order-CSV-Exporter-v${manifest.version}.zip`;
const files = [
  "manifest.json",
  "content.css",
  "content.js",
  "batch-content.js",
  "export-core.js",
  "page-bridge.js",
  "README.md",
  "PRIVACY.md",
  "SUPPORT.md",
  "CHANGELOG.md",
  "LICENSE",
  "assets/Logo 16x.png",
  "assets/Logo 32x.png",
  "assets/Logo 64x.png",
  "assets/Logo 128x.png",
  "assets/temple-logo-light.svg",
];

mkdirSync("dist", { recursive: true });
rmSync(output, { force: true });

const result = spawnSync("zip", ["-X", "-q", output, ...files], {
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Created ${output}`);
