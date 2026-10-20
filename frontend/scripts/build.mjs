import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "dist/camper-route-planner-card.js");
const packagedFrontend = resolve(root, "../custom_components/camper_route_planner/frontend");
await build({ entryPoints: [resolve(root, "src/camper-route-planner-card.js")], bundle: true, format: "iife", platform: "browser", target: ["es2020"], outfile: output, banner: { js: "/* Camper Route Planner Card v0.1.0-alpha.1; reproducible local bundle */" }, logLevel: "info" });
await mkdir(packagedFrontend, { recursive: true });
await copyFile(output, resolve(packagedFrontend, "camper-route-planner-card.js"));
