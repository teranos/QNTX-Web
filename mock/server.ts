#!/usr/bin/env bun
// `bun run mock`: the page against a mock node. No node, no ATS, no Laye.

// > There needs to be a backendless, ats-less laye-less web ui, that only has mock data

// > so its trivial for future sessions to work with it fast.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { isBackendPath } from "../dev-proxy";
import { build, setupWatcher, findAvailablePort, reloadStream, RELOAD_PATH, RELOAD_SCRIPT, lightPink, pink, darkPink, reset, dim } from "../dev-build";
import { Tablet, LEVELS, type Level } from "./reach";
import { PEOPLE, authStatus, canvases, canvasElements, compositions, minimizedWindows } from "./world";

const here = import.meta.dir;
const web = join(here, "..");
const FIXTURES = join(here, "fixtures");
const tablet = Tablet.from(readFileSync(join(here, "tablet-of-reach"), "utf8"));

const PORT_START = parseInt(process.env.FRONTEND_PORT || "8830", 10);
const COOKIE = "qntx_mock_as";
const AS_PATH = "/__mock__/as/";

// > and during mock, needs to be easy to switch who you are
// Nobody, until the mock identity provider has been passed.
function whoIs(req: Request): Level | null {
    const cookie = req.headers.get("cookie") ?? "";
    for (const part of cookie.split(";")) {
        const [name, value] = part.trim().split("=");
        if (name === COOKIE && LEVELS.includes(value as Level)) return value as Level;
    }
    return null;
}

// > mock should have a mock identity provider
// The provider: a page that asks who you are and asserts it, where a node would send you to Google or GitHub.
function identityProvider(): Response {
    const choices = LEVELS.map(level => {
        const who = PEOPLE[level];
        return `<li><a href="${AS_PATH}${level}"><b>${level}</b></a> — ${who.name}, ${who.accounts[0]?.handle ?? ""}, standing in ${who.standing}</li>`;
    }).join("\n");
    const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock identity provider</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font:16px/1.5 monospace">
<main style="max-width:36rem;padding:24px">
<h1 style="font-size:1.2em">Mock identity provider</h1>
<p>No node stands behind this page. Say who you are, and the mock node will take your word for it.</p>
<ul style="list-style:none;padding:0">${choices}</ul>
<p style="color:#888">Signing out in the page brings you back here.</p>
</main>`;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** A session, or a 401 the way a node answers a request from nobody. */
function nobody(path: string): Response {
    return json({ error: `${path}: nobody is signed in to the mock; the mock identity provider is at /` }, 401);
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fixtureFile(path: string): string | null {
    const exact = join(FIXTURES, `${path}.json`);
    if (existsSync(exact)) return exact;
    const index = join(FIXTURES, path, "index.json");
    if (existsSync(index)) return index;
    return null;
}

function fixture(name: string): unknown {
    return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));
}

/** The answers that depend on who is asking. Null hands the request to the fixtures. */
function worldAnswer(level: Level, method: string, path: string, url: URL): Response | null {
    const who = PEOPLE[level];
    if (path === "/setup") return json({ claimed: true });
    if (path === "/auth/status") return json(authStatus(level));
    if (path === "/i/" || path === "/i") return json(who);
    if (path === "/i/picture") return new Response(`${who.name} has no picture`, { status: 404 });
    if (path === "/i/standing") {
        return json({ namespace: who.standing });
    }
    if (path === "/i/reaches") {
        const asked = (url.searchParams.get("paths") ?? "").split(",").filter(p => p !== "");
        return json({ paths: tablet.reached(level, asked) });
    }
    if (path === "/api/dev") return new Response("false");
    if (path === "/api/canvases") return json(canvases(level));
    if (path === "/api/canvas") return json({ name: "pond" });
    if (path.startsWith("/api/canvas/")) {
        if (method !== "GET") return json({});
        if (path === "/api/canvas/elements") return json(canvasElements(level));
        if (path === "/api/canvas/compositions") return json(compositions());
        if (path === "/api/canvas/minimized-windows") return json(minimizedWindows());
    }
    if (path === "/api/plugins/elements") return json({ elements: [] });
    if (path === "/g/") return json({ elements: [] });
    return null;
}

function refused(level: Level, path: string): Response {
    const line = tablet.line(path);
    const named = line ? line.levels.join(" ") : "nobody: the tablet has no line for it";
    return json({ error: `${path} is not reached by ${level}; the tablet names ${named}` }, 403);
}

function answer(req: Request, url: URL): Response {
    const level = whoIs(req);
    const path = url.pathname;
    const method = req.method;

    // Signing out: the page posts here, then reloads; the reload meets the identity provider.
    if (path === "/auth/logout") {
        return new Response(null, { status: 204, headers: { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` } });
    }
    if (level === null) {
        if (path === "/health") return new Response(Bun.file(join(FIXTURES, "health.json")), { headers: { "Content-Type": "application/json" } });
        if (path === "/auth/status") return json({ registered: true });
        return nobody(path);
    }

    if (!tablet.reaches(level, path)) {
        console.log(`${dim}${level} ${method} ${path} -> 403 (tablet)${reset}`);
        return refused(level, path);
    }

    const said = worldAnswer(level, method, path, url);
    if (said) return said;

    if (method !== "GET" && method !== "HEAD") {
        console.log(`${darkPink}${level} ${method} ${path} -> 405: the mock only reads${reset}`);
        return new Response(`${method} ${path}: the mock only reads; mock/server.ts worldAnswer is where a write would be answered`, { status: 405 });
    }

    const file = fixtureFile(path);
    if (!file) {
        const wanted = join("mock/fixtures", `${path}.json`);
        console.log(`${darkPink}${level} GET ${path} -> 404: no fixture; add ${wanted}${reset}`);
        return new Response(`GET ${path}: the mock has no fixture for it; add ${wanted}`, { status: 404 });
    }
    return new Response(Bun.file(file), { headers: { "Content-Type": "application/json" } });
}

/** The strip at the foot of the page: who you are, the two others you can be, and the way out. */
function strip(level: Level): string {
    const links = LEVELS.map(each => each === level
        ? `<b>${each}</b>`
        : `<a href="${AS_PATH}${each}">${each}</a>`).join(" · ");
    return `<div id="mock-strip" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:4px 12px;font:12px/1.4 monospace;background:#fde68a;color:#111;text-align:center">MOCK, no node · you are ${links} · <a href="${AS_PATH}nobody">sign out</a></div>`;
}

async function page(level: Level): Promise<Response> {
    const html = await Bun.file(join(web, "dist", "index.html")).text();
    const mockScript = `<script>window.__MOCK__ = ${JSON.stringify({ as: level })};</script>`;
    return new Response(
        html.replace("</head>", `${mockScript}\n</head>`).replace("</body>", `${strip(level)}${RELOAD_SCRIPT}</body>`),
        { headers: { "Content-Type": "text/html" } },
    );
}

await build();
setupWatcher();
const port = await findAvailablePort(PORT_START, PORT_START + 10);

Bun.serve({
    port,
    async fetch(req, srv) {
        const url = new URL(req.url);
        const path = url.pathname;

        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            const level = whoIs(req);
            if (level === null) return nobody(path);
            if (srv.upgrade(req, { data: { path, level } })) return undefined as unknown as Response;
            return new Response(`WebSocket upgrade failed for ${path}`, { status: 400 });
        }
        if (path === RELOAD_PATH) return reloadStream(req);

        if (path.startsWith(AS_PATH)) {
            const level = path.slice(AS_PATH.length);
            if (level === "nobody") {
                return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` } });
            }
            if (!LEVELS.includes(level as Level)) return new Response(`${level} is not one of ${LEVELS.join(", ")}`, { status: 404 });
            return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=${level}; Path=/; SameSite=Lax` } });
        }
        if (path === "/__mock__/") return json({ as: whoIs(req) ?? "nobody", levels: LEVELS });

        if (isBackendPath(path)) return answer(req, url);

        if (path === "/" || path === "") {
            const level = whoIs(req);
            return level === null ? identityProvider() : page(level);
        }

        const file = Bun.file(join(web, "dist", path));
        if (await file.exists()) return new Response(file);
        return new Response(`${path} is not in dist/`, { status: 404 });
    },

    websocket: {
        open(ws) {
            const { path, level } = ws.data as { path: string; level: Level };
            if (path !== "/ws") {
                console.log(`${dim}${level} socket ${path}: open, the mock says nothing on it${reset}`);
                return;
            }
            ws.send(JSON.stringify({ type: "version", version: "mock", commit: "mock", build_time: new Date().toISOString() }));
            ws.send(JSON.stringify(fixture("am/syscap")));
        },
        message(ws, message) {
            const { level } = ws.data as { path: string; level: Level };
            let type = "";
            try {
                type = (JSON.parse(String(message)) as { type?: string }).type ?? "";
            } catch {
                type = "(not JSON)";
            }
            if (type === "get_database_stats") {
                ws.send(JSON.stringify(fixture("ws/database_stats")));
                return;
            }
            console.log(`${dim}${level} socket message ${type}: the mock does not answer it${reset}`);
        },
    },
});

console.log(`${lightPink}QNTX-Web mock: http://localhost:${port}${reset}`);
console.log(`${pink}Who you are: ${LEVELS.map(l => `${AS_PATH}${l}`).join("  ")}${reset}`);
console.log(`${dim}Answers: mock/world.ts, then mock/fixtures/<path>.json; reach from mock/tablet-of-reach${reset}`);
