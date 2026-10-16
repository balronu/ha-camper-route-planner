import { build } from "esbuild";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
await build({ entryPoints: [resolve(root, "src/camper-route-planner-card.js")], bundle: true, format: "iife", platform: "browser", target: ["es2020"], outfile: resolve(root, "dist/camper-route-planner-card.js"), banner: { js: "/* Camper Route Planner Card v0.1.0-alpha.1; reproducible local bundle */" }, logLevel: "info" });
