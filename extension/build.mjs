import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });

const entries = {
  "service-worker": "src/background/service-worker.ts",
  content: "src/content/content.ts",
  popup: "src/popup/popup.ts",
  options: "src/options/options.ts"
};

await Promise.all(Object.entries(entries).map(([name, entry]) => build({
  entryPoints: [entry],
  outfile: `dist/${name}.js`,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  legalComments: "none"
})));

await Promise.all([
  cp("manifest.json", "dist/manifest.json"),
  cp("src/popup/popup.html", "dist/popup.html"),
  cp("src/popup/popup.css", "dist/popup.css"),
  cp("src/options/options.html", "dist/options.html"),
  cp("src/options/options.css", "dist/options.css"),
  cp("assets", "dist/assets", { recursive: true })
]);
console.log("Built extension/dist");
