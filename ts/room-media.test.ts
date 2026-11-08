import { describe, expect, test, spyOn } from 'bun:test';
import { roomBody, roomResource, roomAttachmentResource } from './room-media';

const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); };

describe('media returned into a room', () => {
    test('provider attachments stay on the node', () => {
        expect(roomAttachmentResource('/api/switchai-py/media?room=r&mxc=x')?.file).toBe('/api/switchai-py/media?room=r&mxc=x');
        for (const path of ['https://elsewhere.test/a', '//elsewhere.test/a', '/api/../auth/keys', '/api/%2e%2e/auth/keys', '/api/x\\other', '/api/x#fragment']) expect(roomAttachmentResource(path)).toBeUndefined();
    });

    test('audio loads only on Listen, plays authenticated bytes, and stops on disposal', async () => {
        const create = spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice');
        const revoke = spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const play = spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        const pause = spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
        const reset = spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
        const paths: string[] = [];
        const body = roomBody('The words', async path => {
            paths.push(path);
            return new Response('audio', { headers: { 'Content-Type': 'audio/mp4' } });
        }, [{ name: 'voice.m4a', type: 'audio/mp4', url: '/api/switchai-py/media?room=r&mxc=x' }]);
        try {
            expect(paths).toHaveLength(0);
            body.element.querySelector('button')!.click();
            await settle();
            expect(paths).toEqual(['/api/switchai-py/media?room=r&mxc=x']);
            expect(body.element.querySelector('audio')?.src).toBe('blob:voice');
            expect(play).toHaveBeenCalledTimes(1);
            body.dispose();
            expect(pause).toHaveBeenCalled();
            expect(body.element.querySelector('audio')?.hasAttribute('src')).toBe(false);
            expect(revoke).toHaveBeenCalledWith('blob:voice');
        } finally { for (const spy of [create, revoke, play, pause, reset]) spy.mockRestore(); }
    });

    test('an audio attachment cannot turn an HTML response into a player', async () => {
        const create = spyOn(URL, 'createObjectURL').mockReturnValue('blob:wrong');
        const pause = spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
        const reset = spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
        const body = roomBody('The words', async () => new Response('<html>Sign in</html>', { headers: { 'Content-Type': 'text/html' } }), [{ name: 'voice.m4a', type: 'audio/mp4', url: '/api/files/a' }]);
        document.body.append(body.element);
        try {
            body.element.querySelector('button')!.click();
            await settle();
            expect(body.element.textContent).toContain('expected audio, received text/html');
            expect(body.element.querySelector('audio')?.hasAttribute('src')).toBe(false);
            body.dispose();
        } finally { body.element.remove(); for (const spy of [create, pause, reset]) spy.mockRestore(); }
    });
    test('only node files use authenticated fetch; external links must be HTTPS', () => {
        expect(roomResource('/api/files/file-1')?.file).toBe('/api/files/file-1');
        expect(roomResource('http://localhost/api/files/file-1')?.file).toBe('/api/files/file-1');
        expect(roomResource('https://example.org/study.png')).toEqual({ url: 'https://example.org/study.png' });
        for (const value of ['javascript:alert(1)', 'data:image/svg+xml,x', '//other.test/x', '/auth/status', '/api/files/../keys', 'https://u:p@h/a', 'file:///tmp/image.png']) {
            expect(roomResource(value)).toBeUndefined();
        }
    });

    test('HTML and code examples stay text while Markdown links remain usable', () => {
        const body = roomBody('<script>alert(1)</script>\n\n```md\n![example](/api/files/x)\n```\n\n[reference](https://example.org/study)\n\n[unsafe](javascript:alert(1))');
        expect(body.element.querySelector('script')).toBeNull();
        expect(body.element.querySelector('img')).toBeNull();
        expect(body.element.querySelector('code')?.textContent).toContain('![example]');
        expect(body.element.querySelectorAll('a')).toHaveLength(1);
        expect(body.element.querySelector('a')?.rel).toBe('noopener noreferrer');
        body.dispose();
    });

    test('a node image is fetched with cancellation, rendered as a blob and released when the room closes', async () => {
        const create = spyOn(URL, 'createObjectURL').mockReturnValue('blob:room-study');
        const revoke = spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        let signal: AbortSignal | undefined;
        const paths: string[] = [];
        const body = roomBody('![study.svg](/api/files/study)', async (path, options) => {
            paths.push(path);
            signal = options?.signal as AbortSignal;
            return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': 'image/svg+xml' } });
        });
        try {
            await settle();
            expect(paths).toEqual(['/api/files/study']);
            expect(body.element.querySelector('img')?.getAttribute('src')).toBe('blob:room-study');
            expect(body.element.querySelector('svg')).toBeNull();
            body.dispose();
            expect(signal?.aborted).toBe(true);
            expect(revoke).toHaveBeenCalledWith('blob:room-study');
        } finally { create.mockRestore(); revoke.mockRestore(); }
    });

    test('a refused file reports the HTTP failure beside the result and keeps its file action', async () => {
        const body = roomBody('![study.png](/api/files/study)', async () => new Response('refused', { status: 403, statusText: 'Forbidden' }));
        await settle();
        expect(body.element.querySelector('.room-media-error')?.textContent).toContain('HTTP 403 Forbidden');
        expect(body.element.querySelector('img')?.hidden).toBe(true);
        expect(body.element.querySelector('a')?.textContent).toBe('study.png');
        body.dispose();
    });

    test('what was sent with a message is read from where the node serves it: an image drawn, a file a link', async () => {
        const create = spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:room-plot');
        const paths: string[] = [];
        const media = '/api/switchai-py/media?room=r&mxc=mxc%3A%2F%2Fplot';
        const body = roomBody('the plot', async path => {
            paths.push(path);
            return new Response('png', { headers: { 'Content-Type': 'image/png' } });
        }, [{ name: 'plot.png', type: 'image/png', url: media }, { name: 'data.csv', type: 'text/csv', url: '/api/switchai-py/media?room=r&mxc=csv' }]);
        try {
            await settle();
            expect(paths).toEqual([media]);
            expect(body.element.querySelector('img')?.getAttribute('src')).toBe('blob:room-plot');
            expect([...body.element.querySelectorAll('a')].map(a => a.textContent)).toEqual(['plot.png', 'data.csv']);
            body.dispose();
        } finally { create.mockRestore(); }
    });
});
