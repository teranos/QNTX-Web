/**
 * An MCP server's yes, coming back to the app. The person says yes at the
 * server in the browser; the server sends that browser to the node's return,
 * which holds no session here and so hands the code on through qntx://mcp.
 * The app is logged in, and posts it to the node as the person at ROOT.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { inApp } from './app-door';
import { apiFetch } from './client/http';
import { showToast } from './toast';
import { log, SEG } from './logger';

/** Where the node's return sends a yes to the app. */
export const MCP_RETURN = 'qntx://mcp';

/** What the node's callback takes back. */
export interface McpYes {
    state: string;
    code?: string;
    iss?: string;
    error?: string;
    error_description?: string;
}

/** The yes a deep link carries, or null: only qntx://mcp with a state is one. */
export function mcpYesIn(urls: string[]): McpYes | null {
    for (const raw of urls) {
        const cut = raw.indexOf('?');
        if (cut === -1 || raw.slice(0, cut) !== MCP_RETURN) continue;
        const q = new URLSearchParams(raw.slice(cut + 1));
        const state = q.get('state');
        if (!state) continue;
        const yes: McpYes = { state };
        for (const key of ['code', 'iss', 'error', 'error_description'] as const) {
            const v = q.get(key);
            if (v) yes[key] = v;
        }
        return yes;
    }
    return null;
}

/** Posts the yes to the node, as the person the app is logged in as, and says how it ended. */
export async function finishMcpYes(yes: McpYes): Promise<void> {
    try {
        const response = await apiFetch('/auth/mcp/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(yes),
        });
        const said = await response.json().catch(() => ({})) as { connected?: boolean; says?: string; error?: string };
        const says = said.says ?? said.error ?? `the node answered ${response.status}`;
        showToast(says, { type: said.connected ? 'success' : response.ok ? 'info' : 'error', duration: 8000 });
    } catch (err: unknown) {
        log.warn(SEG.UI, '[MCP] the yes did not reach the node:', err);
        showToast(`The yes did not reach the node: ${String(err)}`, { type: 'error', duration: 8000 });
    }
}

/**
 * Takes every yes the app is handed: the one that launched it, and each after.
 * Nothing outside the app: a browser has no qntx:// to be handed.
 */
export function receiveMcpYeses(): void {
    if (!inApp()) return;
    invoke<string[] | null>('plugin:deep-link|get_current').then((urls) => {
        const yes = urls ? mcpYesIn(urls) : null;
        if (yes) void finishMcpYes(yes);
    }, (err: unknown) => log.warn(SEG.UI, '[MCP] could not read the deep link the app was opened by:', err));
    listen<string[]>('deep-link://new-url', (event) => {
        const yes = mcpYesIn(event.payload);
        if (yes) void finishMcpYes(yes);
    }).catch((err: unknown) => log.warn(SEG.UI, '[MCP] could not listen for deep links:', err));
}
