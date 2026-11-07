import { defaultMarkdownParser } from 'prosemirror-markdown';
import { DOMSerializer } from 'prosemirror-model';
import { sizeText } from '@teranos/elements';
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

/** A reply's media lives as long as its row, including across room polls. */
export function roomBody(text: string, fetchFile: typeof apiFetch = apiFetch, attachments: RoomAttachment[] = []): { element: HTMLElement; dispose: () => void } {
    const element = document.createElement('div');
    element.className = 'room-message-content';
    sizeText(element, 'md');
    const controller = new AbortController();
    const blobs = new Map<string, Promise<{ url: string; type: string }>>();
    const urls: string[] = [];
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
        const resource = { url: backendUrl() + attachment.url, file: attachment.url };
        const name = attachment.name || 'file';
        if (attachment.type.startsWith('image/')) element.append(mediaOf(resource, name, attachment.url));
        else {
            const held = document.createElement('p');
            held.append(link(resource, name));
            element.append(held);
        }
    }
    return { element, dispose: () => { controller.abort(); for (const url of urls) URL.revokeObjectURL(url); } };

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
