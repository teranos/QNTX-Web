/**
 * QNTX Web Bundle Builder
 *
 * Bundles all web assets into dist/, which a static host serves and QNTX-App
 * carries as its frontendDist. The node serves no page.
 *
 * This is sacred infrastructure code. Every line has blast radius across:
 * - Deployment (CloudFront/S3)
 * - Developer workflow (dev-server.ts rebuilds through this)
 */

import { cp, mkdir, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { Database } from "bun:sqlite";

const sourceDir = import.meta.dir;
const outputDir = join(sourceDir, "dist");

// QNTX's release builds these from its crates and attaches them; package.json
// names the release. Developing the page needs no Rust.
const wasmPackages = ["ats-wasm", "laye-p2p"];

// Ground immediate delivery — notify active Claude sessions of build progress.
const GROUND_DB = join(process.env.HOME ?? "", ".local", "share", "ground", "ground.db");

function groundNotify(name: string, detail: string): void {
  if (!existsSync(GROUND_DB)) return;
  try {
    const db = new Database(GROUND_DB);
    const id = `make-${name}-${Math.floor(Date.now() / 1000)}`;
    const now = new Date();
    const ts = now.toISOString();
    const time = now.toTimeString().slice(0, 8);
    db.run(
      `INSERT OR IGNORE INTO attestations (id, subjects, predicates, contexts, actors, timestamp, source, attributes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, '["qntx-web"]', `["immediate:${name}"]`, '["project:teranos/QNTX-Web"]', '["bun"]', ts, 'build.ts', JSON.stringify({ detail: `${detail} at ${time}`, after: 0 })]
    );
    db.close();
  } catch { /* Ground unavailable — silent */ }
}

// Peach color palette
const peach = "\x1b[38;5;217m";
const darkPeach = "\x1b[38;5;216m";
const lightPeach = "\x1b[38;5;223m";
const red = "\x1b[91m"; // Bright red for errors
const reset = "\x1b[0m";
const dim = "\x1b[2m";

console.log(`${peach}Building QNTX Web UI...${reset}`);
console.log(`${dim}   Source: ${sourceDir}${reset}`);
console.log(`${dim}   Output: ${outputDir}${reset}`);

try {
  // Clean output directory
  console.log(`${darkPeach}Cleaning output directory...${reset}`);
  try {
    await rm(outputDir, { recursive: true, force: true });
  } catch (error: unknown) {
    // Directory might not exist yet
  }

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // Bundle TypeScript with Bun
  console.log(`${darkPeach}Bundling JavaScript...${reset}`);
  const result = await Bun.build({
    entrypoints: [join(sourceDir, "ts", "main.ts")],
    outdir: join(outputDir, "js"),
    minify: false,
    sourcemap: "inline",
    splitting: false, // Disable code splitting to ensure single bundle
    external: [], // Bundle everything, don't externalize anything
    throw: false, // Return errors in result.logs instead of throwing
  });

  if (!result.success) {
    console.error(`\n${red}${'='.repeat(80)}${reset}`);
    console.error(`${red}███ BUNDLE ERRORS ███${reset}`);
    console.error(`${red}${'='.repeat(80)}${reset}`);
    for (const log of result.logs) {
      const pos = log.position;
      const loc = pos ? `${pos.file}:${pos.line}:${pos.column} ` : '';
      console.error(`  ${loc}${log.message}`);
    }
    console.error(`${red}${'='.repeat(80)}${reset}\n`);
    groundNotify("web-build-failed", `Web: bundle FAILED — ${result.logs.map(l => l.message).join("; ")}`);
    process.exit(1);
  }

  // Copy CSS
  console.log(`${darkPeach}Copying CSS...${reset}`);
  await cp(join(sourceDir, "css"), join(outputDir, "css"), { recursive: true });

  // Copy HTML and update script reference
  console.log(`${darkPeach}Copying HTML...${reset}`);
  const htmlContent = await Bun.file(join(sourceDir, "index.html")).text();

  // Update the script src from /ts/main.ts to /js/main.js (the bundled output)
  let updatedHtml = htmlContent.replace('/ts/main.ts', '/js/main.js');

  // Inject backend URL if provided via environment variable (for Vercel/static hosting)
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    console.log(`${lightPeach}Injecting backend URL: ${backendUrl}${reset}`);
    updatedHtml = updatedHtml.replace(
      "</head>",
      `<script>
        // Backend URL for WebSocket connections
        window.__BACKEND_URL__ = "${backendUrl}";
      </script>
      </head>`
    );
  }

  // Where the logger's third sink points, handed to the build by the deploy
  // the way the backend URL is. Unset is off: the page carries no DSN and
  // nothing leaves the tab. A DSN is an ingest key and can only write.
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    console.log(`${lightPeach}Injecting Sentry DSN for the frontend${reset}`);
    updatedHtml = updatedHtml.replace(
      "</head>",
      `<script>
        window.__SENTRY_DSN__ = "${sentryDsn}";
      </script>
      </head>`
    );
  }

  // Stamp the frontend bundle with git commit + build time. The connectivity
  // element reads these globals to show which SPA build is running even when
  // the WebSocket (which normally carries version info from the backend) is
  // broken — the exact case where knowing the build identity matters most.
  // GITHUB_SHA names whichever workflow called the build, which is the deploy
  // repo rather than this one. Kept, because knowing which pipeline ran is
  // worth something — but it is not the code that was built.
  function resolveCommit(): string {
    const envCommit = process.env.GIT_COMMIT || process.env.GITHUB_SHA;
    if (envCommit) return envCommit;
    return resolveWebCommit();
  }
  // The working tree is always the thing being compiled, whoever asked for it.
  function resolveWebCommit(): string {
    const proc = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: sourceDir });
    if (proc.exitCode === 0) {
      const out = proc.stdout.toString().trim();
      if (out) return out;
    }
    return "unknown";
  }
  // The web's own version: its latest tag, and how far past it (git describe); dev when it has none.
  function resolveWebVersion(): string {
    const proc = Bun.spawnSync(["git", "describe", "--tags", "--match", "v*", "--always"], { cwd: sourceDir });
    if (proc.exitCode === 0) {
      const out = proc.stdout.toString().trim();
      if (out.startsWith("v")) return out;
    }
    return "dev";
  }
  const buildCommit = resolveCommit();
  const webCommit = resolveWebCommit();
  const webVersion = resolveWebVersion();
  const buildTime = new Date().toISOString();
  console.log(`${lightPeach}Stamping web build: ${webVersion}, web ${webCommit.slice(0, 7)} via ${buildCommit.slice(0, 7)} @ ${buildTime}${reset}`);
  // commit stays first: consumers find it by cutting on the literal `commit: "`.
  updatedHtml = updatedHtml.replace(
    "</head>",
    `<script>
        window.__QNTX_WEB_BUILD__ = { commit: "${buildCommit}", build_time: "${buildTime}", web: "${webCommit}", version: "${webVersion}" };
      </script>
      </head>`
  );

  await Bun.write(join(outputDir, "index.html"), updatedHtml);

  // Copy fonts
  console.log(`${darkPeach}Copying fonts...${reset}`);
  await cp(join(sourceDir, "fonts"), join(outputDir, "fonts"), { recursive: true });

  // Copy static assets
  console.log(`${darkPeach}Copying static assets...${reset}`);
  await cp(join(sourceDir, "qntx.jpg"), join(outputDir, "qntx.jpg"));
  // The screenshots a story shows, where the page asks for them.
  await cp(join(sourceDir, "img"), join(outputDir, "img"), { recursive: true });
  // "ROOT or developer oriented Stories Element should exist": what it lists, each story by its file and its Feature line.
  const stories = [];
  for (const file of (await readdir(join(sourceDir, "stories"))).filter((f) => f.endsWith(".feature")).sort((a, b) => parseInt(a) - parseInt(b))) {
    const text = await Bun.file(join(sourceDir, "stories", file)).text();
    const feature = text.split("\n").find((line) => line.startsWith("Feature:")) ?? file;
    stories.push({ name: file.replace(/\.feature$/, ""), feature: feature.replace(/^Feature:\s*/, "") });
  }
  await Bun.write(join(outputDir, "stories.json"), JSON.stringify(stories));

  // Copy WASM files for browser IndexedDB storage
  // WASM binaries must be in /js/ alongside bundled JS (import.meta.url resolution)
  console.log(`${darkPeach}Copying WASM modules...${reset}`);
  for (const pkg of wasmPackages) {
    const pkgDir = join(sourceDir, "node_modules", pkg);
    let copiedCount = 0;
    try {
      for (const file of await readdir(pkgDir)) {
        if (file.endsWith('.wasm')) {
          await cp(join(pkgDir, file), join(outputDir, "js", file));
          copiedCount++;
        }
      }
    } catch (error: unknown) {
      console.error(`\n${red}${'='.repeat(80)}${reset}`);
      console.error(`${red}███ FATAL BUILD ERROR: Could not read ${pkgDir} ███${reset}`);
      console.error(`${red}${'='.repeat(80)}${reset}`);
      console.error(`  ${error}`);
      console.error(`  Run: bun install`);
      console.error(`${red}${'='.repeat(80)}${reset}\n`);
      process.exit(1);
    }
    if (copiedCount === 0) {
      console.error(`\n${red}${'='.repeat(80)}${reset}`);
      console.error(`${red}███ FATAL BUILD ERROR: No .wasm in ${pkgDir} ███${reset}`);
      console.error(`${red}${'='.repeat(80)}${reset}\n`);
      process.exit(1);
    }
  }

  console.log(`${peach}Build complete!${reset}`);
  console.log(`${dim}   Output ready at: ${outputDir}${reset}`);

} catch (error: unknown) {
  console.error(`\n${red}${'='.repeat(80)}${reset}`);
  console.error(`${red}███ BUILD FAILED ███${reset}`);
  console.error(`${red}${'='.repeat(80)}${reset}`);
  console.error(`  ${error}`);
  console.error(`${red}${'='.repeat(80)}${reset}\n`);
  groundNotify("web-build-failed", `Web: build FAILED — ${error}`);
  process.exit(1);
}
