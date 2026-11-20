// The chat drawn natively on iOS, by QNTX-App's chat plugin (Exyte Chat): the phone's own text field and keyboard.
// "Use native / Exyte"
// The page keeps the conversation: it opens the chat, shows it what was said, and is told what was typed.
// Anywhere else the plugin says it cannot, and the page's own chat is the chat.

import { invoke, Channel } from '@tauri-apps/api/core';
import { isTauri } from './tauri-notifications';
import type { Turn } from './chat';

/** One thing said, as the native chat shows it: whose, and when in unix milliseconds. */
export interface NativeSaid {
    id: string;
    text: string;
    mine: boolean;
    at: number;
}

/** What the native chat tells the page. */
export interface NativeHeard {
    say(text: string): void;
    stop(): void;
    closed(): void;
}

/** The native chat while it is open. */
export interface NativeChat {
    show(messages: NativeSaid[], answering: boolean): void;
    close(): void;
}

interface Told {
    kind: string;
    text?: string;
}

/** Opens the native chat, or answers null where there is none. */
export async function openNativeChat(title: string, heard: NativeHeard): Promise<NativeChat | null> {
    if (!isTauri()) return null;
    const handler = new Channel<Told>();
    handler.onmessage = (told) => {
        if (told.kind === 'say' && told.text) heard.say(told.text);
        else if (told.kind === 'stop') heard.stop();
        else if (told.kind === 'closed') heard.closed();
    };
    try {
        await invoke('plugin:chat|open', { title, handler });
    } catch {
        return null;
    }
    return {
        show: (messages, answering) => { void invoke('plugin:chat|show', { messages, answering }).catch(() => undefined); },
        close: () => { void invoke('plugin:chat|close').catch(() => undefined); },
    };
}

/** The turns of a session a chat shows: what was said by the person and by the agent, and what failed. */
export function saidOf(turns: Turn[]): NativeSaid[] {
    const said: NativeSaid[] = [];
    turns.forEach((turn, i) => {
        const at = Date.parse(turn.at) || 0;
        const id = `turn-${i}-${turn.at}`;
        switch (turn.speaker) {
            case 'human':
            case 'person':
                said.push({ id, text: turn.text, mine: true, at });
                return;
            case 'assistant':
            case 'agent':
            case 'error':
                said.push({ id, text: turn.text, mine: false, at });
                return;
        }
    });
    return said;
}
