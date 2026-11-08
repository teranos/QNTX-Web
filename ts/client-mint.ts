/**
 * Minting a third-party OAuth client: the one kind of token the node mints.
 * The Connector element is where it is done (connector-element.ts).
 */

// "Tokens are to be removed from QNTX except for third-party OAuth clients"

import { apiJson } from './client/http';

export interface CreateTokenResponse {
    id: string;
    label: string;
    token: string;
    /** The token's DID: a client's id, which an app is set up with beside its secret. */
    did?: string;
    created_at: string;
    expires_at?: string;
}

/** The kind a client is minted as, named the way the node names it (server/auth/admission.go). */
export const OAUTH = 'OAUTH';

// What a client may read and write is not asked here: the roles its DID holds
// say, through their WRITE and READ lines (ADR-034).
export async function createToken(
    label: string,
    level: string,
    namespaces: string[],
    returnAddress: string,
    root = false,
): Promise<CreateTokenResponse> {
    // A token says when it ends, and one minted here does not: it says so.
    const body: Record<string, unknown> = { label, level, namespaces, expires_at: 'never' };
    if (returnAddress) body.return_address = returnAddress;
    // ROOT's client for the node's MCP server (ADR-038), ROOT's alone to mint.
    if (root) body.root = true;
    return await apiJson<CreateTokenResponse>('/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
