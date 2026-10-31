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
import { Agent, Files, type Transcript } from "./agents";
import { CodexAgents } from "./codex";

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
    // A path that names its own file, as /.well-known/did.json does, is that file.
    const named = join(FIXTURES, path);
    if (path.endsWith(".json") && existsSync(named)) return named;
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

// The agents, each with its seeded session where a fixture gives one.
const theNodeAgent = new Agent("the Node Agent", "did:key:mock-node-agent", (fixture("api/claude/session") as { transcript: Transcript }).transcript);
const namespaceAgents = new Map<string, Agent>();
function agentOf(namespace: string): Agent {
    let held = namespaceAgents.get(namespace);
    if (!held) {
        const seeded = fixtureFile(`api/agents/${namespace}/session`);
        const seed = seeded ? (JSON.parse(readFileSync(seeded, "utf8")) as { transcript: Transcript }).transcript : undefined;
        held = new Agent(`the agent of ${namespace}`, `did:key:mock-agent-${namespace}`, seed);
        namespaceAgents.set(namespace, held);
    }
    return held;
}
// > AGENT PER ELEMENT, EACH ELEMENT IS ITS OWN CONVERSATION
const elementAgents = new Map<string, Agent>();
function elementAgent(element: string): Agent {
    let held = elementAgents.get(element);
    if (!held) {
        held = new Agent(`the element ${element}`, `did:key:mock-element-${element}`);
        elementAgents.set(element, held);
    }
    return held;
}
const files = new Files();
const codexAgents = new CodexAgents();

/** The agent paths, answered live: am, session and say, the picture carried along. */
async function agentAnswer(level: Level, method: string, path: string, _url: URL, req: Request): Promise<Response | null> {
    let agent: Agent | null = null;
    let rest = "";
    let wrap: (am: unknown) => unknown = am => ({ claude: am });
    if (path === "/api/agent" || path.startsWith("/api/agent/")) {
        agent = theNodeAgent;
        rest = path.slice("/api/agent".length);
    } else if (path.startsWith("/api/agents/")) {
        const [namespace, ...more] = path.slice("/api/agents/".length).split("/");
        if (!namespace) return null;
        agent = agentOf(decodeURIComponent(namespace));
        rest = more.length ? `/${more.join("/")}` : "";
        wrap = am => ({ namespace, set_by: PEOPLE[level].user, agent: am });
    } else if (path.startsWith("/api/elements/")) {
        const [element, ...more] = path.slice("/api/elements/".length).split("/");
        if (!element) return null;
        agent = elementAgent(decodeURIComponent(element));
        rest = more.length ? `/${more.join("/")}` : "";
    }
    if (!agent) return null;

    if (rest === "" && method === "GET") return json(wrap(agent.am("")));
    if (rest === "/session" && method === "GET") {
        const transcript = agent.read("");
        return transcript ? json({ transcript }) : json({ error: `${agent.of} has no session yet` }, 404);
    }
    if (rest === "/live" && method === "GET") {
        const going = agent.live("");
        if (!going) return json({ error: `${agent.of} is not in a turn, so there is no stream to tail` }, 404);
        const mark = parseInt(_url.searchParams.get("mark") ?? "0", 10) || 0;
        let stop = () => {};
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                const out = new TextEncoder();
                stop = going.listen(mark, event => {
                    if (event) { controller.enqueue(out.encode(`data: ${JSON.stringify(event)}\n\n`)); return; }
                    controller.enqueue(out.encode(`event: end\ndata: ${JSON.stringify({ events: [], live: false, mark: String(going.events.length) })}\n\n`));
                    controller.close();
                });
            },
            cancel() { stop(); },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
    if (rest === "/say" && method === "POST") {
        const sent = (await req.json()) as Record<string, string>;
        if (!sent.says) return json({ error: "says is required" }, 400);
        const said = await agent.say(sent.says, "", sent.file_id ?? "", sent.permission_mode ?? "");
        console.log(`${pink}${level} said to ${agent.of}${sent.file_id ? ` with ${sent.file_id}` : ""}: ${sent.says}${reset}`);
        return json({ claude: said });
    }
    if (rest === "/login" && method === "POST") return json({ url: "", signed_in: true, auth_method: "mock", api_provider: "mock" });
    return null;
}

/** The files the page sends up, kept in memory and served back by id. */
async function filesAnswer(method: string, path: string, req: Request): Promise<Response | null> {
    if (path === "/api/files" && method === "POST") {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "no file field" }, 400);
        const kept = files.keep(new Uint8Array(await file.arrayBuffer()), file.type, file.name);
        console.log(`${pink}file ${kept.id}: ${kept.filename}, ${kept.content_type}, ${kept.size} bytes${reset}`);
        return json(kept);
    }
    if (path.startsWith("/api/files/") && method === "GET") {
        const held = files.get(path.slice("/api/files/".length));
        if (!held) return json({ error: `${path}: the mock holds no such file` }, 404);
        return new Response(held.bytes, { headers: { "Content-Type": held.type } });
    }
    return null;
}

// A namespace's keys, kept in memory. The mock's providers issued every key
// ending in -issued, and answer 401 to any other.
const PROVIDERS = ["anthropic", "openai", "openrouter"];
const keptKeys = new Map<string, Map<string, { set_by: string; at: string; value: string }>>();

function keysOf(namespace: string) {
    const held = keptKeys.get(namespace) ?? new Map();
    const keys = Array.from(held, ([name, key]) => {
        const asked = PROVIDERS.includes(name);
        const accepted = asked && key.value.endsWith("-issued");
        return { name, set_by: key.set_by, at: key.at, asked, accepted, why: asked && !accepted ? `${name} answered 401: invalid x-api-key` : "" };
    });
    return { namespace, keys: keys.sort((a, b) => a.name.localeCompare(b.name)) };
}

// The node at Anthropic (server/node_anthropic.go), kept in memory. The mock's
// Anthropic accepts the node at any fdrl_ rule but fdrl_refused.
const atAnthropic: Record<string, string> = {};
// What ROOT's agents spend first, and whether the other follows (server/anthropic_spend.go).
const spending = { first: "session", then: false };
// The session's windows, as ug's status line reads them.
const SESSION_WINDOWS = [
    { window: "five_hour", used_percentage: 88, resets_at: 1900000000, at: "2026-10-27T17:00:00Z" },
    { window: "seven_day", used_percentage: 41, resets_at: 1900400000, at: "2026-10-27T17:00:00Z" },
];
const ANTHROPIC_KINDS: [string, string][] = [["fdis_", "issuer_id"], ["svac_", "service_account_id"], ["fdrl_", "federation_rule_id"], ["wrkspc_", "workspace_id"]];

function anthropicKindOf(word: string): string | undefined {
    for (const [prefix, kind] of ANTHROPIC_KINDS) if (word.startsWith(prefix) && word.length > prefix.length) return kind;
    if (word.length === 36 && word.split("-").map((part) => part.length).join(",") === "8,4,4,4,12") return "organization_id";
    return undefined;
}

function anthropicAm() {
    const ready = !!(atAnthropic.organization_id && atAnthropic.service_account_id && atAnthropic.federation_rule_id);
    const accepted = ready && atAnthropic.federation_rule_id !== "fdrl_refused";
    return {
        issuer: "https://l.example", subject: "did:key:z6MkmockNode", ...atAnthropic,
        asked: ready, accepted, first: spending.first, then: spending.then, session: SESSION_WINDOWS, in_use: "",
        why: ready && !accepted ? `Anthropic at https://api.anthropic.com did not accept the identity of did:key:z6MkmockNode at rule ${atAnthropic.federation_rule_id}: oauth token request failed (status 401); {"error":{"message":"Authentication failed","type":"authentication_error"}}` : "",
    };
}

async function anthropicAnswer(method: string, path: string, req: Request): Promise<Response | null> {
    if (path === "/api/anthropic/order" && method === "POST") {
        const { first = "", then = "false" } = (await req.json()) as { first?: string; then?: string };
        if (first !== "session" && first !== "console") return json({ error: `first is session or console, not ${first}` }, 400);
        spending.first = first;
        spending.then = then === "true";
        return json(anthropicAm());
    }
    if (path !== "/api/anthropic") return null;
    if (method === "POST") {
        const { given = "" } = (await req.json()) as { given?: string };
        let found = 0;
        for (const word of given.split(/[\s"'`,:;{}]+/)) {
            const kind = anthropicKindOf(word);
            if (kind) { atAnthropic[kind] = word; found++; }
        }
        if (found === 0) return json({ error: `no id of Anthropic's in ${given.trim()}: an organization's is a UUID, an issuer's starts fdis_, a service account's svac_, a rule's fdrl_` }, 400);
    }
    return json(anthropicAm());
}

async function keysAnswer(level: Level, method: string, path: string, req: Request): Promise<Response | null> {
    if (!path.startsWith("/api/keys/")) return null;
    const namespace = decodeURIComponent(path.slice("/api/keys/".length));
    if (method === "GET") return json(keysOf(namespace));
    if (method === "POST") {
        const sent = (await req.json()) as Record<string, string>;
        if (!sent.name || !sent.value) return json({ error: "name and value are required" }, 400);
        const held = keptKeys.get(namespace) ?? new Map();
        held.set(sent.name, { set_by: PEOPLE[level].user, at: new Date().toISOString(), value: sent.value });
        keptKeys.set(namespace, held);
        console.log(`${pink}${level} kept the ${sent.name} key of ${namespace}${reset}`);
        return json(keysOf(namespace));
    }
    return null;
}

function refused(level: Level, path: string): Response {
    const line = tablet.line(path);
    const named = line ? line.levels.join(" ") : "nobody: the tablet has no line for it";
    return json({ error: `${path} is not reached by ${level}; the tablet names ${named}` }, 403);
}

async function answer(req: Request, url: URL): Promise<Response> {
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

    const said = worldAnswer(level, method, path, url)
        ?? await codexAgents.answer(req)
        ?? await agentAnswer(level, method, path, url, req)
        ?? await filesAnswer(method, path, req)
        ?? await keysAnswer(level, method, path, req)
        ?? await anthropicAnswer(method, path, req);
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
    // > think ROOT SHAKE
    // The strip's shake is the phone's: the page hears one event either way (ts/shake.ts).
    const shake = level === "ROOT" ? ` · <a href="#" onclick="window.dispatchEvent(new Event('qntx-shake'));return false">shake</a>` : "";
    return `<div id="mock-strip" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:4px 12px;font:12px/1.4 monospace;background:#fde68a;color:#111;text-align:center">MOCK, no node · you are ${links} · <a href="${AS_PATH}nobody">sign out</a>${shake}</div>`;
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

        if (isBackendPath(path) || path.startsWith("/.well-known/")) return answer(req, url);

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
