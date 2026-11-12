// A proposed interaction, deliberately enabled only by the mock page. The node
// has no transcription service or HTTP room-file posting contract yet.
import { apiJson } from './client';
import { roomVoice } from './room-voice';
import type { Room } from './rooms-element';

export function mockRoomVoice(says: HTMLTextAreaElement, room: Room) {
    const at = `/__mock__/rooms/${encodeURIComponent(room.id)}/voice`;
    return roomVoice(says, {
        transcribe: (audio, signal) => {
            const body = new FormData(); body.set('audio', audio, 'recording'); body.set('type', audio.type);
            return apiJson<{ text: string }>(`${at}/transcribe`, { method: 'POST', body, signal }).then(answer => answer.text);
        },
        send: (words, audio, signal) => {
            const body = new FormData(); body.set('audio', audio, 'recording'); body.set('type', audio.type); body.set('body', words);
            return apiJson(at, { method: 'POST', body, signal });
        },
    }, 'Mock voice · fixture transcript');
}
