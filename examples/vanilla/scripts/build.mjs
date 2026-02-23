import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const siteDir = path.join(projectRoot, "site");
const distDir = path.join(projectRoot, "dist");
const widgetDistDir = path.resolve(projectRoot, "../../packages/searchkit-widget/dist");
const cliPath = path.resolve(projectRoot, "../../packages/searchkit-cli/dist/cli.js");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
fs.cpSync(siteDir, distDir, { recursive: true });

const widgetBundle = path.join(widgetDistDir, "index.global.js");
if (!fs.existsSync(widgetBundle)) {
  throw new Error(`Missing widget bundle at ${widgetBundle}. Run pnpm build first.`);
}
if (!fs.existsSync(cliPath)) {
  throw new Error(`Missing CLI bundle at ${cliPath}. Run pnpm build first.`);
}

fs.copyFileSync(widgetBundle, path.join(distDir, "assets", "searchkit-widget.global.js"));

execSync(`node ${cliPath} build --input ./dist --output ./dist/search --baseUrl /`, {
  cwd: projectRoot,
  stdio: "inherit"
});
