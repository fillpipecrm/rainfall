import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const distPublicDir = path.join(distDir, "public");

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(distPublicDir, { recursive: true });
await fs.cp(publicDir, distPublicDir, { recursive: true });

await fs.writeFile(
  path.join(distDir, "README.txt"),
  "Static assets for Netlify deploy. Dynamic routes are served by Netlify Functions.\n",
  "utf8",
);
