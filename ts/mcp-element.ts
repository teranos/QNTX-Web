// MCP Element (⧉) — the MCP servers a viewer reaches, and a connector minted for one.

// "i wish it was easier to find out, when logged in, what the mcp url is."
// "I actually think this part should be split up into, Node MCP server and Namespace MCP server's"
// "i am very interested in the MCP Element"

import type { Element } from '@teranos/elements';
import { AtField, createTable, fieldFrom, pressFrom, tableCell } from '@teranos/elements';
import { apiJson } from './client/http';
import { log, SEG } from './logger';
import { ordered, type Namespace } from './namespaces-view';
import { MCP } from './sym';
import { openTokenElement } from './token-element';
import { createToken, OAUTH } from './token-mint-element';

export const needs = ['/am/node', '/api/namespaces', '/auth/tokens'] as const;

const ELEMENT_ID = 'mcp-element';

/** What of am node's card says where the node's MCP server answers. */
export interface CardMCP {
    capabilities?: { extensions?: { params?: { mcp?: { url?: string } } }[] };
}

/** Where the node says its MCP server is: the mcp extension of its card. */
export function nodeMCPOf(card: CardMCP): string | undefined {
    return (card.capabilities?.extensions ?? []).map((e) => e.params?.mcp?.url).find((url) => !!url);
}

/** One MCP server: the node's names no namespace, and a namespace's is /mcp/<namespace> (server/mcp.go). */
export interface MCPServer {
    name: string;
    url: string;
    namespace?: string;
}

export function mcpServers(node: string, namespaces: string[]): MCPServer[] {
    return [
        { name: 'the node', url: node },
        ...namespaces.map((namespace) => ({ name: namespace, url: `${node}/${encodeURIComponent(namespace)}`, namespace })),
    ];
}

/** Exported for tests: the servers, and the fields a connector is minted with. */
export function renderMCP(container: HTMLElement, node: string, namespaces: string[]): void {
    container.className = 'element-content';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    const label = fieldFrom({ id: 'mcp-connector-label', label: 'Connector label', placeholder: 'what this connector is for' });
    // Where the client's codes go, as the token mint asks it (ADR-025).
    const returnAddress = fieldFrom({ id: 'mcp-connector-return', label: 'Return address', placeholder: 'https://app.example/callback' });

    const rows = mcpServers(node, namespaces).map((server) => {
        const url = tableCell(server.url);
        url.style.userSelect = 'text';
        // A connector acts in the namespace it was minted in, and answers at that server alone (ADR-038).
        const mint = document.createElement('td');
        if (server.namespace) mint.appendChild(connectorPress(server, label.input, returnAddress.input).element);
        return { cells: [server.name, url, mint] as const, id: server.url };
    });

    container.append(
        createTable('mcp-servers', ['Server', 'URL', 'Connector'] as const, rows),
        label.element,
        returnAddress.element,
    );
}

/** A connector minted for one namespace's server: the client opens as a token, its secret shown once. */
function connectorPress(server: MCPServer, label: HTMLInputElement, returnAddress: HTMLInputElement) {
    return pressFrom({
        id: `mcp-connector-${server.namespace}`,
        title: 'Connector',
        again: `mints a connector for ${server.url}`,
        creates: true,
        does: async () => {
            const named = label.value.trim();
            if (!named) throw new AtField(label, 'no label');
            const returning = returnAddress.value.trim();
            if (!returning) throw new AtField(returnAddress, 'no return address');
            const minted = await createToken(named, OAUTH, [server.namespace!], returning);
            label.value = '';
            openTokenElement(minted.id, minted.label, minted.token);
        },
    });
}

// "but i want a MCP specifically for the Node, only for ROOT"
// "for root it can be in i of the root or on am"

/** ROOT's client for the node's MCP server, drawn on am for ROOT (ADR-038): its secret shown once. */
export function rootsClient(): HTMLElement {
    const held = document.createElement('div');
    held.className = 'element-section';
    const label = fieldFrom({ id: 'roots-client-label', label: "ROOT's client", placeholder: 'what this client is for' });
    const returnAddress = fieldFrom({ id: 'roots-client-return', label: 'Return address', placeholder: 'https://app.example/callback' });
    const press = pressFrom({
        id: 'roots-client',
        title: "ROOT's client",
        again: "mints ROOT's client for the node's MCP server",
        creates: true,
        does: async () => {
            const named = label.input.value.trim();
            if (!named) throw new AtField(label.input, 'no label');
            const returning = returnAddress.input.value.trim();
            if (!returning) throw new AtField(returnAddress.input, 'no return address');
            const minted = await createToken(named, OAUTH, [], returning, true);
            label.input.value = '';
            openTokenElement(minted.id, minted.label, minted.token);
        },
    });
    held.append(label.element, returnAddress.element, press.element);
    return held;
}

/** What the element draws once the node said where its server is and which namespaces there are. */
async function drawInto(content: HTMLElement): Promise<void> {
    try {
        const [card, listed] = await Promise.all([
            apiJson<{ card: CardMCP }>('/am/node'),
            apiJson<{ namespaces: Namespace[] }>('/api/namespaces'),
        ]);
        const node = nodeMCPOf(card.card ?? {});
        if (!node) throw new Error('the node card names no MCP server');
        renderMCP(content, node, ordered(listed.namespaces ?? []).map((ns) => ns.name));
    } catch (err) {
        const said = err instanceof Error ? err.message : String(err);
        log.warn(SEG.SELF, `[mcp] ${said}`);
        const why = document.createElement('div');
        why.className = 'status-unwell';
        why.textContent = said;
        content.appendChild(why);
    }
}

export function createMCPElement(): Element {
    return {
        id: ELEMENT_ID,
        title: 'MCP',
        symbol: MCP,
        renderContent: () => {
            const content = document.createElement('div');
            void drawInto(content);
            return content;
        },
    };
}
