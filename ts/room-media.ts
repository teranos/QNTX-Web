import { defaultMarkdownParser } from 'prosemirror-markdown';
import { DOMSerializer } from 'prosemirror-model';
import { pressFrom, sizeText } from '@teranos/elements';
import { apiFetch, backendUrl } from './client';

/** Links in a room's body are the existing rooms.proto contract, not attachments. */
export function roomResource(value: string): { url: string; file?: string } | undefined {
    if (value !== value.trim() || /[\u0000-\u0020\\]/.test(value)) return;
    const filePath = /^\/api\/files\/[a-zA-Z0-9._-]+$/;
    if (filePath.test(value)) return { url: backendUrl() + value, file: value };
    try {
        const url = new URL(value);
        if (url.username || url.password) return;
        if (url.origin === new URL(backendUrl()).origin || url.origin === window.location.origin) {
            if (filePath.test(url.pathname) && !url.search && !url.hash) return { url: url.href, file: url.pathname };
            return;
        }
        if (url.protocol === 'https:') return { url: url.href };
    } catch { /* A relative path or an invalid URL stays text. */ }
    return;
}

/** RoomAttachment: a file sent with a message, at the path the node serves its bytes. */
export interface RoomAttachment { name: string; type: string; url: string }

/** Provider media is read through the node, never with credentials sent elsewhere. */
export function roomAttachmentResource(path: string): { url: string; file: string } | undefined {
    if (!path.startsWith('/api/') || /[\u0000-\u0020\\]/.test(path)) return;
    const url = new URL(path, backendUrl());
    if (url.pathname !== path.split(/[?#]/)[0] || url.hash) return;
    return { url: url.href, file: path };
}

/** A reply's media lives as long as its row, including across room polls. */
export function roomBody(text: string, fetchFile: typeof apiFetch = apiFetch, attachments: RoomAttachment[] = []): { element: HTMLElement; dispose: () => void } {
    const element = document.createElement('div');
    element.className = 'room-message-content';
    sizeText(element, 'md');
    const controller = new AbortController();
    const blobs = new Map<string, Promise<{ url: string; type: string }>>();
    const urls: string[] = [];
    const players: HTMLAudioElement[] = [];
    const load = (file: string) => {
        let pending = blobs.get(file);
        if (!pending) {
            pending = fetchFile(file, { signal: controller.signal }).then(async response => {
                if (!response.ok) throw new Error(`${file}: HTTP ${response.status} ${response.statusText}`);
                const blob = await response.blob();
                controller.signal.throwIfAborted();
                const url = URL.createObjectURL(blob);
                urls.push(url);
                return { url, type: blob.type };
            }).catch(err => { blobs.delete(file); throw err; });
            blobs.set(file, pending);
        }
        return pending;
    };
    const failure = (parent: HTMLElement, err: unknown) => {
        if (controller.signal.aborted) return;
        const note = document.createElement('span');
        note.className = 'room-media-error';
        note.setAttribute('role', 'status');
        note.textContent = err instanceof Error ? err.message : String(err);
        parent.append(note);
    };
    const link = (resource: NonNullable<ReturnType<typeof roomResource>>, name: string) => {
        const a = document.createElement('a');
        a.href = resource.url;
        a.className = 'room-file';
        a.textContent = name;
        if (resource.file) {
            a.dataset.file = resource.file;
            a.addEventListener('click', async event => {
                event.preventDefault();
                if (a.getAttribute('aria-busy') === 'true') return;
                a.setAttribute('aria-busy', 'true');
                a.parentElement?.querySelector('.room-media-error')?.remove();
                try {
                    const held = await load(resource.file!);
                    if (controller.signal.aborted) return;
                    const download = document.createElement('a');
                    download.href = held.url;
                    download.download = name || a.textContent || 'file';
                    download.click();
                } catch (err) { failure(a.parentElement ?? element, err); }
                finally { a.removeAttribute('aria-busy'); }
            });
        } else {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        return a;
    };
    const base = DOMSerializer.fromSchema(defaultMarkdownParser.schema);
    const serializer = new DOMSerializer({ ...base.nodes,
        image: node => {
            const src = String(node.attrs.src);
            const name = String(node.attrs.alt || 'Image');
            const resource = roomResource(src);
            if (!resource) return document.createTextNode(`![${name}](${src})`);
            return mediaOf(resource, name, src);
        },
    }, { ...base.marks,
        link: mark => {
            const resource = roomResource(String(mark.attrs.href));
            // The serializer fills this mark with its original label.
            return resource ? link(resource, '') : document.createElement('span');
        },
    });
    element.append(serializer.serializeFragment(defaultMarkdownParser.parse(text).content));
    // What was sent with it is the node's to serve, read as the page reads the node.
    for (const attachment of attachments) {
        const name = attachment.name || 'file';
        const resource = roomAttachmentResource(attachment.url);
        if (!resource) { failure(element, new Error(`Invalid attachment URL: ${attachment.url}`)); continue; }
        if (attachment.type.startsWith('image/')) element.append(mediaOf(resource, name, attachment.url));
        else if (attachment.type.startsWith('audio/')) element.append(audioOf(resource, name));
        else {
            const held = document.createElement('p');
            held.append(link(resource, name));
            element.append(held);
        }
    }
    return { element, dispose: () => {
        controller.abort();
        for (const player of players) { player.pause(); player.removeAttribute('src'); player.load(); }
        for (const url of urls) URL.revokeObjectURL(url);
    } };

    function audioOf(resource: NonNullable<ReturnType<typeof roomAttachmentResource>>, name: string): HTMLElement {
        const media = document.createElement('div');
        media.className = 'room-media room-audio';
        const player = document.createElement('audio');
        player.controls = true;
        player.preload = 'none';
        player.hidden = true;
        player.setAttribute('aria-label', `Recording: ${name}`);
        players.push(player);
        const listen = pressFrom({ id: 'room-listen', title: 'Listen', does: async () => {
            const held = await load(resource.file);
            if (controller.signal.aborted) return;
            if (!held.type.toLowerCase().startsWith('audio/')) throw new Error(`${name}: expected audio, received ${held.type || 'no content type'}`);
            player.src = held.url;
            player.hidden = false;
            await player.play();
            listen.element.remove();
        } });
        player.addEventListener('error', () => {
            failure(media, new Error(`${name}: ${player.error?.message || 'Audio could not be played'}`));
        });
        const caption = document.createElement('span');
        caption.className = 'room-media-caption';
        sizeText(caption, 'xs');
        caption.append(link(resource, name));
        media.append(listen.element, player, caption);
        return media;
    }

    function mediaOf(resource: NonNullable<ReturnType<typeof roomResource>>, name: string, src: string): HTMLElement {
        const media = document.createElement('span');
        media.className = 'room-media';
        const image = document.createElement('img');
        image.alt = name;
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        const caption = document.createElement('span');
        caption.className = 'room-media-caption';
        sizeText(caption, 'xs');
        caption.append(link(resource, name));
        media.append(image, caption);
        image.addEventListener('error', () => {
            image.hidden = true;
            failure(media, new Error(`Image could not be displayed: ${src}`));
        }, { once: true });
        if (resource.file) {
            media.setAttribute('aria-busy', 'true');
            void load(resource.file).then(held => {
                if (controller.signal.aborted) return;
                if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(held.type)) throw new Error(`${src}: expected an image, received ${held.type || 'no content type'}`);
                image.src = held.url;
            }).catch(err => { image.hidden = true; failure(media, err); })
                .finally(() => media.removeAttribute('aria-busy'));
        } else image.src = resource.url;
        return media;
    }
}
