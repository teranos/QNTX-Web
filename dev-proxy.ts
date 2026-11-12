/**
 * Relaying the dev server to a backend that is not on this machine.
 * Pure rules only — dev-server.ts owns the sockets.
 */

// A copy of what the node serves at /openapi.json, kept here because that path
// is behind the door and this is read before any credential is.
import openapi from "./openapi.json";
import { createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";

export interface Backend {
    url: string;
    isRemote: boolean;
}

/** QNTX_BACKEND names a whole backend; without it, a port beside us. */
export function resolveBackend(env: Record<string, string | undefined>, backendPort: number): Backend {
    const named = env.QNTX_BACKEND;
    if (!named) {
        return { url: `http://localhost:${backendPort}`, isRemote: false };
    }
    const url = named.endsWith('/') ? named.slice(0, -1) : named;
    const isRemote = url.indexOf('localhost') === -1 && url.indexOf('127.0.0.1') === -1;
    return { url, isRemote };
}

// What the relay presents as itself: the key this machine keeps, signing each
// request for the node it goes to, or a borrowed session.
//
// "A signature proves the key, and nothing reusable leaves the node."
export interface Credential {
    /** The seed in ~/.qntx/key, sixty-four hex characters. */
    seed?: string;
    /** The node a signature is for: its public origin. */
    audience?: string;
    session?: string;
}

// `held` is what ~/.qntx/key holds: the key ground and the qntx CLI sign with,
// which the node holds a grant for. A session named in the environment is the
// operator saying which to present.
export function resolveCredential(env: Record<string, string | undefined>, held = '', audience = ''): Credential {
    if (env.QNTX_SESSION) {
        return { session: env.QNTX_SESSION };
    }
    if (held) {
        return { seed: held, audience };
    }
    return {};
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(bytes: Uint8Array): string {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let out = '';
    while (n > 0n) {
        out = B58[Number(n % 58n)] + out;
        n /= 58n;
    }
    for (const b of bytes) {
        if (b !== 0) break;
        out = '1' + out;
    }
    return out;
}

function base64url(bytes: Uint8Array | string): string {
    return Buffer.from(bytes).toString('base64url');
}

/**
 * The Authorization one request goes with: a JWT signed by the key whose seed
 * is given, as its did:key, for audience, lasting a minute, with an id of its
 * own — the node admits each once.
 */
export function signedFor(seedHex: string, audience: string, nowSeconds: number): string {
    const seed = Buffer.from(seedHex.trim(), 'hex');
    if (seed.length !== 32) {
        throw new Error('~/.qntx/key holds no 32-byte seed in hex');
    }
    const key = createPrivateKey({
        key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
        format: 'der',
        type: 'pkcs8',
    });
    const spki = createPublicKey(key).export({ format: 'der', type: 'spki' });
    const did = 'did:key:z' + base58(Uint8Array.from([0xed, 0x01, ...spki.subarray(spki.length - 32)]));
    const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({
        iss: did, sub: did, aud: audience,
        exp: Math.floor(nowSeconds) + 60,
        jti: randomBytes(16).toString('hex'),
    }));
    const signature = base64url(sign(null, Buffer.from(`${header}.${claims}`), key));
    return `Signed ${header}.${claims}.${signature}`;
}

/**
 * allowed_origins names where browsers come from, and localhost is in the
 * defaults. Empty leaves the browser's own origin, which is such a browser.
 */
export function resolveOrigin(env: Record<string, string | undefined>): string {
    return env.QNTX_ORIGIN || '';
}

/**
 * The node checks Origin against allowed_origins and refuses a socket carrying
 * none, so the browser's is forwarded. Host describes the hop, not the message.
 */
export function backendHeaders(incoming: Headers, credential: Credential, origin: string): Headers {
    const h = new Headers(incoming);
    if (origin) {
        h.set('Origin', origin);
    }
    h.delete('host');

    // The relay authenticates as itself. Whatever the browser held is for the
    // dev server's own origin and means nothing to the node.
    h.delete('cookie');
    h.delete('authorization');

    if (credential.seed) {
        h.set('Authorization', signedFor(credential.seed, credential.audience || '', Date.now() / 1000));
    } else if (credential.session) {
        h.set('Cookie', `qntx_session=${credential.session}`);
    }
    return h;
}

/**
 * The browser is never handed the node's cookie. Minted by an https node it
 * arrives Secure, and the session travels on the relay's own hop anyway.
 */
export function dropSetCookie(response: Response): Response {
    if (response.headers.getSetCookie().length === 0) {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.delete('set-cookie');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** What the node answers, by first segment. The root is the prefix of every
 *  path, so it is the prefix of none. */
export function prefixesOf(paths: string[]): string[] {
    const held = new Set<string>();
    for (const path of paths) {
        const next = path.indexOf('/', 1);
        const prefix = next === -1 ? path : path.slice(0, next);
        if (prefix === '' || prefix === '/') {
            continue;
        }
        held.add(prefix);
    }
    return [...held];
}

// Written by hand this is a second answer to what the node serves, and it had
// drifted both ways: /i, /am, /g and /s were missing, /lsp named nothing.
const BACKEND_PREFIXES = prefixesOf(Object.keys(openapi.paths));

/** A prefix matches a whole segment, so /authors is not /auth. */
export function isBackendPath(pathname: string): boolean {
    return BACKEND_PREFIXES.some(prefix => {
        if (!pathname.startsWith(prefix)) {
            return false;
        }
        const rest = pathname.slice(prefix.length);
        return rest === "" || rest.startsWith("/");
    });
}

// QNTX_DEV_PLUGIN_DIRS=name=/abs/dir,name2=/abs/dir2: each name is served from its directory under /api/{name}/.
export function resolveDevPluginDirs(env: Record<string, string | undefined>): Map<string, string> {
    const dirs = new Map<string, string>();
    const spec = env.QNTX_DEV_PLUGIN_DIRS;
    if (!spec) {
        return dirs;
    }
    for (const entry of spec.split(',')) {
        const eq = entry.indexOf('=');
        if (eq <= 0) {
            throw new Error(`QNTX_DEV_PLUGIN_DIRS: "${entry}" is not name=/abs/dir`);
        }
        const name = entry.slice(0, eq).trim();
        const dir = entry.slice(eq + 1).trim();
        if (!name || !dir.startsWith('/')) {
            throw new Error(`QNTX_DEV_PLUGIN_DIRS: "${entry}" is not name=/abs/dir`);
        }
        dirs.set(name, dir);
    }
    return dirs;
}

/** The socket follows the scheme the backend answers on. */
export function backendWsUrl(backendUrl: string, pathWithQuery: string): string {
    const base = backendUrl.startsWith('https://')
        ? `wss://${backendUrl.slice('https://'.length)}`
        : `ws://${backendUrl.slice('http://'.length)}`;
    return base + pathWithQuery;
}
