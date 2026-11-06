import { describe, expect, test } from 'bun:test';
import { mcpYesIn } from './mcp-return';

describe('An MCP yes coming back to the app', () => {
    test('qntx://mcp with a state is a yes, and carries what the node takes back', () => {
        expect(mcpYesIn(['qntx://mcp?state=S1&code=C1&iss=https%3A%2F%2Fsentry.io'])).toEqual({ state: 'S1', code: 'C1', iss: 'https://sentry.io' });
    });
    test('a refusal at the server is carried back too', () => {
        expect(mcpYesIn(['qntx://mcp?state=S1&error=access_denied'])).toEqual({ state: 'S1', error: 'access_denied' });
    });
    test('the app door, another path, or no state is not a yes', () => {
        expect(mcpYesIn(['qntx://door?ceremony=T', 'qntx://mcpx?state=S', 'qntx://mcp?code=C'])).toBeNull();
    });
});
