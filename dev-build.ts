// What `bun run dev` and `bun run mock` share: building dist/, rebuilding on a
// change, telling open pages to reload, and finding a port.

import { watch } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const lightPink = "\x1b[38;5;225m";
export const pink = "\x1b[38;5;218m";
export const darkPink = "\x1b[38;5;211m";
export const reset = "\x1b[0m";
export const dim = "\x1b[2m";

const BUILD_DEBOUNCE = 300;

interface ReloadClient {
    write: (data: string) => void;
}

const clients: Set<ReloadClient> = new Set();
let buildTimeout: NodeJS.Timeout | null = null;
let isBuilding = false;

/** Runs build.ts. Pages open on the reload stream are told to reload when it succeeds. */
export async function build(): Promise<void> {
    if (isBuilding) {
        console.log(`${dim}Build already in progress, skipping...${reset}`);
        return;
    }
    isBuilding = true;
    console.log(`${pink}Building...${reset}`);
    try {
        await execAsync("bun run build.ts");
        console.log(`${lightPink}Build complete${reset}`);
        broadcastReload();
    } catch (error: unknown) {
        console.error(`${darkPink}Build failed:${reset}`, error);
    } finally {
        isBuilding = false;
    }
}

function broadcastReload(): void {
    const message = "data: reload\n\n";
    clients.forEach(client => client.write(message));
}

/** Rebuilds on a change under ts/, css/ or to index.html. */
export function setupWatcher(): void {
    const dirs = ["./ts", "./css", "./index.html"];
    dirs.forEach(dir => {
        watch(dir, { recursive: true }, (_eventType, filename) => {
            if (filename?.endsWith('.ts') || filename?.endsWith('.css') || filename?.endsWith('.html')) {
                console.log(`${pink}Changed: ${filename}${reset}`);
                if (buildTimeout) clearTimeout(buildTimeout);
                buildTimeout = setTimeout(build, BUILD_DEBOUNCE);
            }
        });
    });
    console.log(`${dim}Watching for changes in: ${dirs.join(", ")}${reset}`);
}

/** The path a page listens on for reloads. */
export const RELOAD_PATH = "/__dev_reload__";

/** The server-sent event stream a page holds open until the next build. */
export function reloadStream(req: Request): Response {
    return new Response(
        new ReadableStream({
            start(controller) {
                const client: ReloadClient = { write: (data: string) => controller.enqueue(data) };
                clients.add(client);
                req.signal.addEventListener("abort", () => clients.delete(client));
            }
        }),
        {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        }
    );
}

/** The script a served page carries so it reloads after a build. */
export const RELOAD_SCRIPT = `<script>
    // Live reload for development
    const evtSource = new EventSource("${RELOAD_PATH}");
    evtSource.onmessage = (event) => {
        if (event.data === "reload") {
            console.log("Reloading...");
            location.reload();
        }
    };
</script>`;

async function isPortAvailable(port: number): Promise<boolean> {
    try {
        const server = Bun.serve({ port, fetch() { return new Response("test"); } });
        server.stop();
        return true;
    } catch {
        return false;
    }
}

/** The first free port from start, up to max. */
export async function findAvailablePort(startPort: number, maxPort: number): Promise<number> {
    for (let port = startPort; port <= maxPort; port++) {
        if (await isPortAvailable(port)) return port;
    }
    throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
}
