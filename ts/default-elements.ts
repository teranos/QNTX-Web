/**
 * The default tray: every element the node opens with, added to the ElementRun.
 *
 * The tray is what we use. All palette functionality has been replaced by the
 * tray, fully — the symbol row that sat beside it is gone.
 */

import { tray } from '@teranos/elements';
import { restInSidebar } from './sidebar.ts';
import { forTheViewer, askTheNode, type Audience } from './audience';
import { createCanvasElement, needs as canvasNeeds } from './components/element/canvas/canvas-element';
import { createDbElement, needs as dbNeeds } from './db-element';
import { createEmbeddingsElement, needs as embeddingsNeeds } from './embeddings-element';
import { createSigmaPanel, needs as sigmaNeeds } from './sigma-panel';
import { createPluginElement, needs as pluginNeeds } from './plugin-panel.ts';
import { createPulseElement, needs as pulseNeeds } from './pulse-panel.ts';
import { createHandlersElement, needs as handlersNeeds } from './handlers-panel.ts';
import { createLlmProviderElement, needs as llmNeeds } from './llm-provider-element.ts';
import { createTokensElement, needs as tokensNeeds } from './tokens-element.ts';
import { createRolesElement, needs as rolesNeeds } from './roles-element.ts';
import { createUsersElement, needs as usersNeeds } from './users-element.ts';
import { createMarketElement, needs as marketNeeds } from './market-element.ts';
import { createMailElement, needs as mailNeeds } from './mail-element.ts';
import { createApprovalsElement, needs as approvalsNeeds } from './approvals-element.ts';
import { createGroundElement, needs as groundNeeds } from './ground-element.ts';
import { createAgentsElement, needs as agentsNeeds } from './agents-element.ts';
import { createIElement, needs as iNeeds } from './i-element.ts';
import { createAmElement, needs as amNeeds } from './am-element.ts';
import { createConnectorElement, needs as connectorNeeds } from './connector-element.ts';
import { createParityElement, needs as parityNeeds } from './parity-element.ts';
import { log, SEG } from './logger.ts';

export { updateDatabaseStats, recordEviction } from './db-element';
export { updateSigmaPanel } from './sigma-panel';

// The build and the backends are what the node is, so ≡ holds them. The names
// the socket already calls stay, and forward.
export { updateAmVersion as updateSelfVersion, updateAmCapabilities as updateSelfCapabilities } from './am-element.ts';

// Register default system elements. A namespace with no canvas has no canvas
// element either: nothing of it is drawn, not even the dot in the tray.
// "the ui needs to stop suggesting things that arent possible, needs to stop handing out dead birds"
export async function registerDefaultElements(hasCanvas: boolean = true): Promise<void> {
    const offered: Audience[] = [
        // Canvas Element - Fractal container with spatial grid
        ...(hasCanvas ? [{ needs: canvasNeeds, create: createCanvasElement }] : []),
        // Database Statistics Element
        { needs: dbNeeds, create: createDbElement },
        // Sigma Overview Panel
        { needs: sigmaNeeds, create: createSigmaPanel },
        // Embeddings Element
        { needs: embeddingsNeeds, create: createEmbeddingsElement },
        // ⍟ — who is looking
        { needs: iNeeds, create: createIElement },
        // ≡ — what the node is, and what it was told to be
        { needs: amNeeds, create: createAmElement },
        // ⧉ — Connectors: ChatGPT, Claude, Obsidian, OpenRouter and GitHub, each its own story.
        // Obsidian and GitHub open from here, and are not in the tray of their own.
        { needs: connectorNeeds, create: createConnectorElement },
        // Access Tokens Element — opened from ⍟ (ADR-025)
        { needs: tokensNeeds, create: createTokensElement },
        { needs: usersNeeds, create: createUsersElement },
        // Roles Element — every role the lines name, opened from ⍟ (ADR-034)
        { needs: rolesNeeds, create: createRolesElement },
        // Stands Element — every stand across markets (ADR-035)
        { needs: marketNeeds, create: createMarketElement },
        // Mail Element — what the node mails on plugins' behalf, opened from ⍟ (ADR-041)
        { needs: mailNeeds, create: createMailElement },
        // Approvals Element — what waits on the human, opened from ⍟ (ADR-052)
        { needs: approvalsNeeds, create: createApprovalsElement },
        // Ground Element — aware of anything Ground; the sessions it recorded, each opened as a Transcript
        { needs: groundNeeds, create: createGroundElement },
        // ✦ — Agents: every agent this person reaches, each a chat, the harness a tab (ADR-048, ADR-054)
        { needs: agentsNeeds, create: createAgentsElement },
        // Pulse Panel Element — scheduled jobs dashboard
        { needs: pulseNeeds, create: createPulseElement },
        // Plugin Panel Element — panel manifestation
        { needs: pluginNeeds, create: createPluginElement },
        // Handlers Panel Element — handler attestation management
        { needs: handlersNeeds, create: createHandlersElement },
        // ≍ — a signum held to a reference it follows, the seam in both sides' words
        { needs: parityNeeds, create: createParityElement },
        // LLM Provider Element — provider selection (replaces ai-provider-window)
        { needs: llmNeeds, create: createLlmProviderElement },
    ];

    const forThem = await forTheViewer(offered, askTheNode);
    // A standing element rests in the sidebar; the tray is for what is put
    // down and for the temporal (sidebar.ts). The canvas opens as the
    // workspace, which a button cannot become, so it alone rests in the tray.
    for (const each of forThem) {
        const item = each.create();
        if (item.opensAs === 'workspace') tray.add(item);
        else restInSidebar(item);
    }

    log.debug(SEG.UI, 'Default elements registered:', {
        offered: offered.length,
        added: forThem.length,
    });
}
