/**
 * Obsidian element — a vault's folders, each bound by clicking to a folder of a
 * repository, and what each bound folder is now (ADR-049).
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';

const noAnswer = () => Promise.resolve(new Response());
let answer: (path: string, init?: RequestInit) => Promise<Response> = noAnswer;
let answers: Record<string, unknown> = {};
mock.module('./client', () => ({
    connectivity: {
        get state() { return 'online' as const; },
        get authenticated() { return true; },
        subscribe: () => () => {},
        subscribeAuth: () => () => {},
        reportReachable: () => {},
        reportHttpFailure: () => {},
        reportUnauthenticated: () => {},
        reportAuthenticated: () => {},
        setWebSocketConnected: () => {},
    },
    apiFetch: (path: string, init?: RequestInit) => answer(path, init),
    apiJson: (path: string) => {
        return path in answers ? Promise.resolve(answers[path]) : Promise.reject(new Error(`nothing answers ${path}`));
    },
    backendUrl: () => 'http://localhost',
    backendWsUrl: () => 'ws://localhost',
    backendPath: (path: string) => 'http://localhost' + path,
    sendMessage: () => false,
    connectWebSocket: () => {},
    registerHandler: () => {},
    unregisterHandler: () => {},
}));

const { renderVault, load, createObsidianElement, NOT_SET_UP } = await import('./obsidian-element');

afterEach(() => {
    answer = noAnswer;
    answers = {};
    document.body.innerHTML = '';
});

const flush = async () => {
    for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));
};

const reload = () => Promise.resolve();

const vault = { name: 'abcd', path: '/var/lib/obsidian/abcd', folders: [] as string[] };
const dirs = ['ABCD', 'ABCD/lttr', 'Course Material'];

function shown(view = { vault, dirs, states: [] as never[] }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderVault(container, view, reload);
    return container;
}

const row = (container: HTMLElement, place: string) => container.querySelector<HTMLElement>(`.obsidian-row[data-place="${place}"]`)!;
const click = (container: HTMLElement, text: string) => {
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.startsWith(text));
    if (!button) throw new Error(`no button ${text} among ${[...container.querySelectorAll('button')].map(b => b.textContent).join(', ')}`);
    button.click();
};

describe('a vault not set up yet', () => {
    // "the real claim is one thing"
    test('a node that keeps no vault says it is not set up yet', async () => {
        answers = { '/api/vault': { vaults: [] } };
        const body = createObsidianElement().renderContent();
        await flush();
        expect(body.querySelector('.obsidian-not-set-up')?.textContent).toBe(NOT_SET_UP);
    });

    // "why cant it be conditional"
    test('a node that keeps a vault says nothing of setting one up', async () => {
        answers = {
            '/api/vault': { vaults: [vault] },
            '/api/vault/dirs?name=abcd': { dirs },
            '/api/vault/states?name=abcd': { folders: [] },
        };
        const body = createObsidianElement().renderContent();
        await flush();
        expect(body.querySelector('.obsidian-vault-name')?.textContent).toBe('abcd');
        expect(body.querySelector('.obsidian-not-set-up')).toBeNull();
    });
});

// "you need to do some separate shit first before you can use your synced obsidian vault"
describe('the key of what still stands', () => {
    test('a vault whose copy is not on the box wears the key, and says what on hover', () => {
        const gone = 'the vault\'s copy is not on the box at /var/lib/obsidian/abcd: sign in to Obsidian Sync there and keep it syncing, by hand until #1091';
        const container = shown({ vault: { ...vault, setup: gone }, dirs, states: [] });
        const key = container.querySelector<HTMLElement>('.obsidian-setup')!;
        expect(key.textContent).toContain('setup');
        expect(key.title).toBe(gone);
    });

    test('nothing standing, no key', () => {
        expect(shown().querySelector('.obsidian-setup')).toBeNull();
    });
});

describe('the vault is its folders', () => {
    test('the top folders show, and a folder opens to show its own', () => {
        const container = shown();
        expect(row(container, 'ABCD')).toBeTruthy();
        expect(row(container, 'Course Material')).toBeTruthy();
        expect(row(container, 'ABCD/lttr')).toBeFalsy();
        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-twist')!.click();
        expect(row(container, 'ABCD/lttr')).toBeTruthy();
    });

    test('each vault is asked for its folders and their states', async () => {
        answers = {
            '/api/vault': { vaults: [vault] },
            '/api/vault/dirs?name=abcd': { dirs },
            '/api/vault/states?name=abcd': { folders: [] },
        };
        const container = document.createElement('div');
        await load(container);
        expect(container.querySelector('.obsidian-vault-name')?.textContent).toBe('abcd');
        expect(row(container, 'Course Material')).toBeTruthy();
    });

    test('no vault is said, not left blank', async () => {
        answers = { '/api/vault': { vaults: [] } };
        const container = document.createElement('div');
        await load(container);
        expect(container.textContent).toBe(NOT_SET_UP);
    });
});

describe('a folder is bound by clicking', () => {
    test('owner, repository, folder, and two presses of Confirm', async () => {
        answers = {
            '/api/vault/owners': { owners: [{ login: 'abcd-nl', type: 'Organization', installation: '7' }, { login: 'abcd', type: 'User', installation: '8' }] },
            '/api/vault/repos?installation=7': { repos: ['github.com/abcd-nl/clean'] },
            '/api/vault/subdirs?repo=github.com%2Fabcd-nl%2Fclean&path=': { dirs: ['cdr', 'docs'], branch: 'trunk' },
            '/api/vault/subdirs?repo=github.com%2Fabcd-nl%2Fclean&path=docs': { dirs: ['docs/adr'], branch: 'trunk' },
        };
        let sent: unknown = null;
        answer = (path, init) => {
            sent = { path, body: JSON.parse(String(init?.body)) };
            return Promise.resolve(new Response('{}'));
        };
        const container = shown();

        row(container, 'Course Material').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        click(container, 'Bind to repository');
        await flush();
        expect(container.querySelector('.obsidian-list')?.textContent).toContain('abcd-nl  org');
        expect(container.querySelector('.obsidian-list')?.textContent).toContain('abcd  user');
        click(container, 'abcd-nl');
        await flush();
        click(container, 'clean');
        await flush();
        // A folder is chosen by its name, or opened by ▸ to choose inside it.
        const docs = container.querySelectorAll('.obsidian-subdir')[1];
        expect(docs.firstElementChild?.textContent).toBe('▸');
        docs.querySelector<HTMLButtonElement>('.obsidian-into')!.click();
        await flush();
        // "concept of default branch, not main or master"
        expect(container.querySelector('.obsidian-list')?.textContent).toContain('on trunk, its default branch');
        click(container, 'adr');
        expect(container.querySelector('.obsidian-panel')?.textContent).toContain('github.com/abcd-nl/clean@trunk:docs/adr=Course Material');

        click(container, 'Confirm');
        await flush();
        expect(sent).toBeNull();
        click(container, 'Confirm');
        await flush();
        expect(sent).toEqual({ path: '/api/vault/bind', body: { name: 'abcd', place: 'Course Material', repo: 'github.com/abcd-nl/clean', path: 'docs/adr' } });
    });

    test('a folder inside a bound one is not offered for binding, and says why', () => {
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'active', why: '' },
        ] as never[] });
        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-twist')!.click();
        row(container, 'ABCD/lttr').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-refused')?.textContent).toBe('ABCD and ABCD/lttr are one place in the vault, or one holds the other');
        expect(container.textContent).not.toContain('Bind to repository');
    });
});

// "in reality its still one story"
describe('Tim: a file or directory is bound by clicking', () => {
    const picking = () => {
        answers = {
            '/api/vault/owners': { owners: [{ login: 'abcd-nl', type: 'Organization', installation: '7' }] },
            '/api/vault/repos?installation=7': { repos: ['github.com/abcd-nl/clean'] },
            '/api/vault/subdirs?repo=github.com%2Fabcd-nl%2Fclean&path=': { dirs: ['cdr', 'docs'], files: ['AGENTS.md', '13-root-connects-obsidian.feature'], branch: 'main' },
        };
        let sent: unknown = null;
        answer = (path, init) => {
            sent = { path, body: JSON.parse(String(init?.body)) };
            return Promise.resolve(new Response('{}'));
        };
        return { sent: () => sent };
    };

    const toTheTop = async (container: HTMLElement) => {
        row(container, 'Course Material').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        click(container, 'Bind to repository');
        await flush();
        click(container, 'abcd-nl');
        await flush();
        click(container, 'clean');
        await flush();
    };

    test('notes and stories are offered beside directories, the repository\'s top included', async () => {
        picking();
        const container = shown();
        await toTheTop(container);
        const list = container.querySelector('.obsidian-list')!;
        expect([...list.querySelectorAll('.obsidian-file')].map(f => f.textContent)).toEqual(['AGENTS.md', '13-root-connects-obsidian.feature']);
        expect([...list.querySelectorAll('.obsidian-subdir:not(.obsidian-file)')].map(d => d.lastElementChild?.textContent)).toEqual(['cdr', 'docs']);
    });

    test('a file pressed is bound as a note of the folder pressed, by its own name', async () => {
        const { sent } = picking();
        const container = shown();
        await toTheTop(container);
        click(container, 'AGENTS.md');
        expect(container.querySelector('.obsidian-panel')?.textContent).toContain('github.com/abcd-nl/clean@main:AGENTS.md=Course Material/AGENTS.md');
        click(container, 'Confirm');
        await flush();
        click(container, 'Confirm');
        await flush();
        expect(sent()).toEqual({ path: '/api/vault/bind', body: { name: 'abcd', place: 'Course Material/AGENTS.md', repo: 'github.com/abcd-nl/clean', path: 'AGENTS.md' } });
    });

    test('a story pressed is bound as its note', async () => {
        const { sent } = picking();
        const container = shown();
        await toTheTop(container);
        click(container, '13-root-connects-obsidian.feature');
        click(container, 'Confirm');
        await flush();
        click(container, 'Confirm');
        await flush();
        expect(sent()).toEqual({ path: '/api/vault/bind', body: { name: 'abcd', place: 'Course Material/13-root-connects-obsidian.feature.md', repo: 'github.com/abcd-nl/clean', path: '13-root-connects-obsidian.feature' } });
    });

    test('a bound note is a row in its folder, with its state, and opens as a bound folder does', () => {
        const folder = 'github.com/teranos/QNTX@main:AGENTS.md=ABCD/lttr/AGENTS.md';
        const container = shown({ vault: { ...vault, folders: [folder] }, dirs, states: [
            { folder, place: 'ABCD/lttr/AGENTS.md', state: 'active', why: '', branch: '', pull: '' },
        ] as never[] });
        const note = row(container, 'ABCD/lttr/AGENTS.md');
        expect(note.querySelector('.obsidian-bound')?.textContent).toBe('⇄ github.com/teranos/QNTX@main:AGENTS.md');
        expect(note.querySelector('.obsidian-state-active')).toBeTruthy();
        note.querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-panel')?.textContent).toContain(folder);
        expect(container.textContent).toContain('Unbind');
    });
});

describe('a binding is always in sight', () => {
    // "and if there is a binding, i expect it to not be collapsed and hidden, all per dir bdingings to repo need to be visible at all times"
    test('the folders holding a bound one are open, and stay open', () => {
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD/lttr'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD/lttr', place: 'ABCD/lttr', state: 'active', why: '' },
        ] as never[] });
        expect(row(container, 'ABCD/lttr')).toBeTruthy();
        const twist = row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-twist')!;
        expect(twist.textContent).toBe('▾');
        expect(twist.disabled).toBe(true);
        twist.click();
        expect(row(container, 'ABCD/lttr')).toBeTruthy();
    });
});

describe('a bound folder is unbound', () => {
    // "and if expanded, there should be a two stage button to allow me to unbind as well."
    test('opened, it is unbound with two presses', async () => {
        let sent: unknown = null;
        answer = (path, init) => {
            sent = { path, body: JSON.parse(String(init?.body)) };
            return Promise.resolve(new Response('{}'));
        };
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'active', why: '' },
        ] as never[] });
        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-panel')?.textContent).toContain('github.com/abcd-nl/clean@main:cdr=ABCD');

        click(container, 'Unbind');
        await flush();
        expect(sent).toBeNull();
        click(container, 'Unbind');
        await flush();
        expect(sent).toEqual({ path: '/api/vault/unbind', body: { name: 'abcd', place: 'ABCD' } });
    });
});

describe('a bound folder is disabled and enabled', () => {
    // "and another button to simply disable it, but the bind is still there, it just doesnt do anything"
    test('one press disables it, and a disabled one is enabled the same way', async () => {
        const sent: unknown[] = [];
        answer = (path, init) => {
            sent.push({ path, body: JSON.parse(String(init?.body)) });
            return Promise.resolve(new Response('{}'));
        };
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD', 'github.com/abcd-nl/clean@main:docs=Course Material'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'active', why: '' },
            { folder: 'github.com/abcd-nl/clean@main:docs=Course Material', place: 'Course Material', state: 'disabled', why: '' },
        ] as never[] });
        expect(row(container, 'Course Material').classList.contains('obsidian-row-disabled')).toBe(true);
        expect(row(container, 'Course Material').title).toBe('disabled');

        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        click(container, 'Disable');
        await flush();
        row(container, 'Course Material').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        click(container, 'Enable');
        await flush();
        expect(sent).toEqual([
            { path: '/api/vault/disable', body: { name: 'abcd', place: 'ABCD' } },
            { path: '/api/vault/enable', body: { name: 'abcd', place: 'Course Material' } },
        ]);
    });
});

describe('a bound folder sends to a branch only when told to', () => {
    // "i dont want that to be automatically opted in,"
    // "and i want to set what the name of the branch would be in the obsidian element in the binding."
    test('a folder that sends nothing is told to, with the branch named, by two presses', async () => {
        let sent: unknown = null;
        answer = (path, init) => {
            sent = { path, body: JSON.parse(String(init?.body)) };
            return Promise.resolve(new Response('{}'));
        };
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'active', why: '', branch: '', pull: '' },
        ] });
        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-sending')?.textContent).toContain('Sends nothing back.');
        container.querySelector<HTMLInputElement>('.obsidian-branch')!.value = 'obsidian-abcd';
        click(container, 'Send to this branch');
        await flush();
        expect(sent).toBeNull();
        click(container, 'Send to this branch');
        await flush();
        expect(sent).toEqual({ path: '/api/vault/send', body: { name: 'abcd', place: 'ABCD', branch: 'obsidian-abcd' } });
    });

    test('a folder that sends says where, links its pull request, and is stopped', async () => {
        let sent: unknown = null;
        answer = (path, init) => {
            sent = { path, body: JSON.parse(String(init?.body)) };
            return Promise.resolve(new Response('{}'));
        };
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'changes', why: '', branch: 'obsidian-abcd', pull: 'https://github.com/abcd-nl/clean/pull/1' },
        ] });
        expect(row(container, 'ABCD').classList.contains('obsidian-row-changes')).toBe(true);
        expect(row(container, 'ABCD').title).toBe('PR has changes (obsidian-abcd)');
        row(container, 'ABCD').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-sending')?.textContent).toContain('Sends the vault\'s changes to obsidian-abcd');
        expect(container.querySelector<HTMLAnchorElement>('.obsidian-pull')?.href).toBe('https://github.com/abcd-nl/clean/pull/1');
        click(container, 'Stop sending');
        await flush();
        expect(sent).toEqual({ path: '/api/vault/send', body: { name: 'abcd', place: 'ABCD', branch: '' } });
    });

    test('one whose branch holds nothing more says so', () => {
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'unchanged', why: '', branch: 'obsidian-abcd', pull: '' },
        ] });
        expect(row(container, 'ABCD').classList.contains('obsidian-row-unchanged')).toBe(true);
        expect(row(container, 'ABCD').title).toBe('PR has no changes (obsidian-abcd)');
    });
});

describe('a bound folder says what it is now', () => {
    // "what should a valid binding show? that its active, green dot,"
    // "let's say color state is part of the row itself, the round dot remains, but has no text, hover shows text or reason."
    test('the row is its state, and its dot says it only when hovered', () => {
        const container = shown({ vault: { ...vault, folders: ['github.com/abcd-nl/clean@main:cdr=ABCD', 'github.com/abcd-nl/clean@main:gone=Course Material'] }, dirs, states: [
            { folder: 'github.com/abcd-nl/clean@main:cdr=ABCD', place: 'ABCD', state: 'active', why: '' },
            { folder: 'github.com/abcd-nl/clean@main:gone=Course Material', place: 'Course Material', state: 'invalid', why: 'GitHub GET /repos/abcd-nl/clean/contents/gone answered 404: Not Found' },
        ] as never[] });
        expect(row(container, 'ABCD').classList.contains('obsidian-row-active')).toBe(true);
        expect(row(container, 'ABCD').querySelector('.obsidian-state-active')?.textContent).toBe('');
        expect(row(container, 'ABCD').title).toBe('active');
        expect(row(container, 'ABCD').querySelector('.obsidian-bound')?.textContent).toBe('⇄ github.com/abcd-nl/clean@main:cdr');
        expect(row(container, 'Course Material').classList.contains('obsidian-row-invalid')).toBe(true);
        expect(row(container, 'Course Material').querySelector('.obsidian-state-invalid')?.textContent).toBe('');
        expect(row(container, 'Course Material').title).toBe('Invalid: GitHub GET /repos/abcd-nl/clean/contents/gone answered 404: Not Found');
        expect(container.querySelector('.obsidian-record')?.textContent).toContain('github.com/abcd-nl/clean@main:gone=Course Material');
    });
});

// "why isn't it indicated that it's a bound file, and to what?"
describe('a folder holding bound notes', () => {
    const note = 'github.com/abcd-nl/clean@main:AGENTS.md=Course Material/AGENTS.md';
    const holding = () => {
        answers = {
            '/api/vault/owners': { owners: [{ login: 'abcd-nl', type: 'Organization', installation: '7' }] },
            '/api/vault/repos?installation=7': { repos: ['github.com/abcd-nl/clean'] },
            '/api/vault/subdirs?repo=github.com%2Fabcd-nl%2Fclean&path=': { dirs: ['cdr'], files: ['AGENTS.md', 'README.md'], branch: 'main' },
            '/api/vault/subdirs?repo=github.com%2Fabcd-nl%2Fclean&path=cdr': { dirs: [], files: [], branch: 'main' },
        };
        return shown({ vault: { ...vault, folders: [note] }, dirs, states: [
            { folder: note, place: 'Course Material/AGENTS.md', state: 'active', why: '', branch: '', pull: '' },
        ] as never[] });
    };

    test('says what it holds, and offers only a note beside them', async () => {
        const container = holding();
        expect(row(container, 'Course Material/AGENTS.md').querySelector('.obsidian-bound')?.textContent).toBe('⇄ github.com/abcd-nl/clean@main:AGENTS.md');
        row(container, 'Course Material').querySelector<HTMLButtonElement>('.obsidian-name')!.click();
        expect(container.querySelector('.obsidian-panel')?.textContent).toContain('Holds bound notes: AGENTS.md');
        click(container, 'Bind a note to a repository file');
        await flush();
        click(container, 'abcd-nl');
        await flush();
        click(container, 'clean');
        await flush();
        const list = container.querySelector('.obsidian-list')!;
        expect(list.textContent).toContain('AGENTS.md  bound as Course Material/AGENTS.md');
        // A folder's name opens it rather than choosing it: there is nothing to refuse later.
        click(container, 'cdr');
        await flush();
        expect(container.textContent).not.toContain('one place in the vault');
        expect(container.textContent).not.toContain('this folder');
    });
});
