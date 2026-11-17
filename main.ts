// Hand-in for the make.fun frontend bounty: copies the static app (and any
// screenshots) into the output directory and writes dossier.json there.
// Node standard library only; the dossier builder comes from the vendor file.

import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

const limits = {
  text_max_bytes: 163840,
  screenshots_max: 3,
  screenshot_max_bytes: 262144,
  app_max_entries: 993,
  app_max_bytes: 16777216,
};

async function copyDirContents(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyDirContents(from, to);
    } else {
      await cp(from, to);
    }
  }
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const appSrc = path.join(repoRoot, "app");
  const appDest = path.join(outputDir, "app");
  await mkdir(appDest, { recursive: true });
  await copyDirContents(appSrc, appDest);

  const shotsDest = path.join(outputDir, "screenshots");
  await mkdir(shotsDest, { recursive: true });
  const shotsSrc = path.join(repoRoot, "screenshots");
  try {
    const info = await stat(shotsSrc);
    if (info.isDirectory()) await copyDirContents(shotsSrc, shotsDest);
  } catch {
    // No screenshots directory in the repo yet; the output keeps an empty one.
  }

  // buildDossier returns the dossier as bytes (a Uint8Array of JSON text),
  // not as a plain object — writing it with JSON.stringify would turn it
  // into a useless object of numbered keys. Write the bytes as they are;
  // only stringify when the builder hands back a plain object instead.
  const dossier = await buildDossier(outputDir, limits);
  const dossierPath = path.join(outputDir, "dossier.json");
  if (typeof dossier === "string" || dossier instanceof Uint8Array) {
    await writeFile(dossierPath, dossier);
  } else {
    await writeFile(dossierPath, JSON.stringify(dossier, null, 2) + "\n", "utf8");
  }
  const dossierBytes = (await stat(dossierPath)).size;
  const appFiles = (await readdir(appDest)).length;
  console.log(`dossier.json written (${dossierBytes} bytes) to ${dossierPath}`);
  console.log(`app/ copied: ${appFiles} top-level entries`);
}

await main();
