import { describe, expect, test, spyOn } from 'bun:test';
import { roomBody, roomResource } from './room-media';

const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); };

describe('media returned into a room', () => {
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
});
