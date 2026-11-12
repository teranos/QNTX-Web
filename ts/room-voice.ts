import { pressFrom, sizeText } from '@teranos/elements';

/** The room owns the draft; a service owns transcription and persistence. */
export interface VoiceService {
    transcribe(audio: Blob, signal: AbortSignal): Promise<string>;
    send(words: string, audio: Blob, signal: AbortSignal): Promise<unknown>;
}

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SECONDS = 120;

/** Capture the original voice, review its words, then send the two together. */
export function roomVoice(says: HTMLTextAreaElement, service: VoiceService, label: string) {
    const element = document.createElement('div');
    element.className = 'room-voice';
    const controls = document.createElement('div');
    controls.className = 'room-voice-controls';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    sizeText(status, 'xs');
    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'metadata';
    player.setAttribute('aria-label', 'Review your recording');
    player.hidden = true;
    let gone = false;
    let busy = false;
    let draft: Blob | undefined;
    let url: string | undefined;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let request = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;

    const note = (text: string) => { status.textContent = `${label} · ${text}`; };
    const tracksOff = () => { stream?.getTracks().forEach(track => track.stop()); stream = undefined; };
    const release = () => {
        player.pause(); player.removeAttribute('src'); player.load(); player.hidden = true;
        if (url) URL.revokeObjectURL(url);
        url = undefined; draft = undefined;
    };
    const reset = () => {
        request.abort(); request = new AbortController();
        if (timer) clearInterval(timer);
        timer = undefined;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        recorder = undefined;
        tracksOff(); release(); busy = false;
        record.element.disabled = false;
        stopWrap.hidden = true; recordWrap.hidden = false; discardWrap.hidden = true;
        note('Record up to 2 minutes');
    };
    const stop = pressFrom({ id: 'room-voice-stop', title: 'Stop', does: () => {
        if (recorder?.state === 'recording') recorder.stop();
        tracksOff();
        if (timer) clearInterval(timer);
        timer = undefined;
        stopWrap.hidden = true;
        note('Transcribing');
    } });
    const discard = pressFrom({ id: 'room-voice-discard', title: 'Discard audio', does: reset });
    const record = pressFrom({ id: 'room-voice-record', title: 'Record', does: async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            throw new Error('Recording needs microphone access in a supported browser over HTTPS.');
        }
        busy = true;
        const signal = request.signal;
        note('Waiting for microphone');
        try {
            const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (signal.aborted || gone) { acquired.getTracks().forEach(track => track.stop()); return; }
            stream = acquired;
            const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
            recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
            const held = recorder;
            const chunks: Blob[] = [];
            let bytes = 0;
            let recordingError: string | undefined;
            held.ondataavailable = event => {
                if (signal.aborted) return;
                chunks.push(event.data); bytes += event.data.size;
                if (bytes > MAX_BYTES && held.state !== 'inactive') { recordingError = 'Recording exceeded 3 MiB. Record a shorter message.'; held.stop(); }
            };
            held.onerror = () => { recordingError = 'The microphone recording failed.'; if (held.state !== 'inactive') held.stop(); };
            held.onstop = async () => {
                if (signal.aborted || gone) return;
                tracksOff(); if (timer) clearInterval(timer); timer = undefined;
                stopWrap.hidden = true;
                draft = new Blob(chunks, { type: held.mimeType || chunks[0]?.type });
                try {
                    if (recordingError || !draft.size || draft.size > MAX_BYTES) throw new Error(recordingError || 'The recording is empty or too large.');
                    url = URL.createObjectURL(draft); player.src = url; player.hidden = false;
                    discardWrap.hidden = false;
                    note('Transcribing');
                    const words = await service.transcribe(draft, signal);
                    if (signal.aborted || gone) return;
                    says.value = [says.value.trim(), words.trim()].filter(Boolean).join(' ');
                    note('Review the words, then send');
                } catch (err) {
                    if (signal.aborted || gone) return;
                    note(err instanceof Error ? err.message : String(err));
                    // A transcription refusal keeps the original recording for review or manual dictation.
                    if (!url) { draft = undefined; recordWrap.hidden = false; }
                } finally { if (!signal.aborted && !gone) busy = false; }
            };
            held.start(1000);
            recordWrap.hidden = true; stopWrap.hidden = false; discardWrap.hidden = false;
            let seconds = 0;
            note('Recording · 0:00');
            timer = setInterval(() => {
                seconds++;
                note(`Recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
                if (seconds >= MAX_SECONDS) { held.stop(); tracksOff(); clearInterval(timer); timer = undefined; }
            }, 1000);
        } catch (err) {
            tracksOff(); busy = false;
            note(err instanceof Error ? err.message : String(err));
            throw err;
        }
    } });
    const wrap = (node: HTMLElement) => { const div = document.createElement('div'); div.append(node); return div; };
    const recordWrap = wrap(record.element), stopWrap = wrap(stop.element), discardWrap = wrap(discard.element);
    controls.append(recordWrap, stopWrap, discardWrap, status);
    element.append(controls, player);
    stopWrap.hidden = true; discardWrap.hidden = true;
    note('Record up to 2 minutes');
    return {
        element,
        busy: () => busy,
        hasDraft: () => !!draft,
        send: async (words: string) => {
            if (!draft || busy) throw new Error('Finish recording before sending.');
            busy = true; discard.element.disabled = true;
            try { await service.send(words, draft, request.signal); reset(); }
            finally { busy = false; discard.element.disabled = false; }
        },
        dispose: () => { gone = true; reset(); },
    };
}

export type RoomVoice = ReturnType<typeof roomVoice>;
