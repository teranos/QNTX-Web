// MCP Element (⧉) — the MCP servers a viewer reaches, and a connector minted for one.
// Tim: the node's server and each namespace's. Spike: what is not said.

import { describe, test, expect, beforeEach } from 'bun:test';
import { mcpServers, nodeMCPOf, renderMCP } from './mcp-element';

const NODE = 'https://api.q.sbvh.nl/mcp';

describe('Tim: the node and its namespaces', () => {
    test("the node's server is where its card says, and a namespace's is under it", () => {
        expect(mcpServers(NODE, ['Clean', 'default'])).toEqual([
            { name: 'the node', url: 'https://api.q.sbvh.nl/mcp' },
            { name: 'Clean', url: 'https://api.q.sbvh.nl/mcp/Clean', namespace: 'Clean' },
            { name: 'default', url: 'https://api.q.sbvh.nl/mcp/default', namespace: 'default' },
        ]);
    });

    test('the URL is read off the card the node gives (am node)', () => {
        const card = { capabilities: { extensions: [{ params: {} }, { params: { mcp: { url: NODE, protocolVersion: '2026-07-28' } } }] } };
        expect(nodeMCPOf(card)).toBe(NODE);
    });
});

describe('Spike: what is not said', () => {
    let container: HTMLElement;
    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    test('a card naming no MCP server names none', () => {
        expect(nodeMCPOf({})).toBeUndefined();
        expect(nodeMCPOf({ capabilities: { extensions: [{ params: {} }] } })).toBeUndefined();
    });

    test("every server is a row with its URL, and only a namespace's mints a connector", () => {
        renderMCP(container, NODE, ['Clean']);
        const rows = Array.from(container.querySelectorAll('tbody tr'));
        expect(rows).toHaveLength(2);
        expect(rows[0]!.textContent).toContain('https://api.q.sbvh.nl/mcp');
        expect(rows[0]!.querySelector('[data-press]')).toBeNull();
        expect(rows[1]!.textContent).toContain('https://api.q.sbvh.nl/mcp/Clean');
        expect(rows[1]!.querySelector('[data-press]')).not.toBeNull();
    });

    test('nothing in it is underlined: no URL here is a link out', () => {
        renderMCP(container, NODE, ['Clean']);
        expect(container.querySelector('a')).toBeNull();
    });
});
