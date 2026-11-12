import { expect, test, spyOn } from 'bun:test';
import { roomVoice } from './room-voice';

test('closing while microphone permission is pending stops a late stream', async () => {
    const devices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    const originalRecorder = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
    const pause = spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const reset = spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    let giveStream!: (stream: MediaStream) => void;
    let stopped = 0;
    let transcribed = 0;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise<MediaStream>(resolve => { giveStream = resolve; }) } });
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: class {} });
    const voice = roomVoice(document.createElement('textarea'), {
        transcribe: async () => { transcribed++; return ''; }, send: async () => {},
    }, 'Test');
    try {
        voice.element.querySelector<HTMLButtonElement>('[data-press="room-voice-record"]')!.click();
        await Promise.resolve();
        voice.dispose();
        giveStream({ getTracks: () => [{ stop: () => { stopped++; } }] } as unknown as MediaStream);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(stopped).toBe(1);
        expect(transcribed).toBe(0);
        expect(voice.hasDraft()).toBe(false);
    } finally {
        if (devices) Object.defineProperty(navigator, 'mediaDevices', devices); else Reflect.deleteProperty(navigator, 'mediaDevices');
        if (originalRecorder) Object.defineProperty(globalThis, 'MediaRecorder', originalRecorder); else Reflect.deleteProperty(globalThis, 'MediaRecorder');
        pause.mockRestore(); reset.mockRestore();
    }
});
