// pond: the ground the mock publishes at /g/, so the page has one wherever the mock runs.
// Still water, a ripple when the node's statusline changes, brighter while it answers.
// Boring on purpose; the ground that matters is published to a node, not kept here.

// "default global backdrop can be boring is ok"
// "via /g/ as a full fledged Element like we talked about before"

export const elementDef = { symbol: '≋', title: 'pond', label: 'pond' };

/** The hue of an agent's ring: its model's family, so a different model is a different species of ring. */
// "the model is a different species per model"
function hueOf(agent) {
    const model = (agent.model || agent.harness || '').toLowerCase();
    if (model.includes('claude') || agent.harness === 'claude') return 28;
    if (model.includes('gemini') || agent.harness === 'agy') return 150;
    if (model.includes('gpt') || agent.harness === 'codex') return 95;
    return 205;
}

/** On the canvas: a line saying what this is. The ground is drawn by backdrop(), not here. */
export function render() {
    const el = document.createElement('div');
    el.className = 'pond-element';
    el.textContent = 'pond: the ground the mock publishes at /g/. Choose it, or plain, from your picture.';
    return el;
}

/**
 * The ground: fills the layer, reads live every frame, and what it returns stops it.
 * Held by a room, each agent in the room is a spring in the water, rippling in its own time.
 */
// "so 3 Agents is 3 fish."
export function backdrop(layer, { live, room }) {
    const canvas = document.createElement('canvas');
    const agents = room?.agents ?? [];
    if (room) canvas.dataset.agents = String(agents.length);
    layer.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // One ripple as the ground arrives, so it is seen to be water before the node first changes.
    const ripples = [{ x: 0, y: 0, born: live.now() / 1000 }];
    let frame = 0;
    let lastOnset = 0;
    let width = 0;
    let height = 0;

    const size = () => {
        width = canvas.width = layer.clientWidth || window.innerWidth;
        height = canvas.height = layer.clientHeight || window.innerHeight;
    };
    size();
    ripples[0].x = width * 0.6;
    ripples[0].y = height * 0.5;
    window.addEventListener('resize', size);

    const draw = () => {
        const t = live.now() / 1000;
        const level = live.audio.level;
        const onset = live.audio.onset;
        if (onset > 0.9 && t - lastOnset > 0.6) {
            lastOnset = t;
            ripples.push({ x: width * (0.2 + 0.6 * Math.random()), y: height * (0.2 + 0.6 * Math.random()), born: t });
        }
        // 「[Fable 5.1] Each agent a spring, spread across the water. A stronger model is a wider ring; more effort, a quicker one;」
        // 「[Fable 5.1] the model's family is the ring's hue.」
        // "stronger model is stronger bigger fish"
        // "effort translated to speed"
        agents.forEach((agent, i) => {
            const period = 6 - 4 * agent.speed;
            const phase = (t + i * period / agents.length) % period;
            if (phase < 0.03 && !ripples.some(r => r.by === agent.name && t - r.born < 1)) {
                ripples.push({ x: width * ((i + 1) / (agents.length + 1)), y: height * 0.55, born: t, by: agent.name, size: 0.6 + agent.strength, hue: hueOf(agent) });
            }
        });
        ctx.fillStyle = `rgb(${16 + level * 12} ${22 + level * 16} ${30 + level * 20})`;
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 1;
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            const age = t - r.born;
            if (age > 6) { ripples.splice(i, 1); continue; }
            for (let k = 0; k < 3; k++) {
                const radius = (age - k * 0.4) * 90 * (r.size ?? 1);
                if (radius <= 0) continue;
                ctx.strokeStyle = `hsl(${r.hue ?? 205} 25% 55% / ${Math.max(0, 0.35 - age * 0.06)})`;
                ctx.beginPath();
                ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        // The slow swell of still water: broad bands, wide enough to show through the glass over them.
        ctx.lineWidth = 14;
        for (let y = -20; y < height + 20; y += 40) {
            const tone = 0.5 + 0.5 * Math.sin(y / 120 + t * 0.25);
            ctx.strokeStyle = `rgba(90 130 170 / ${0.10 + tone * 0.16 + level * 0.14})`;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 16) ctx.lineTo(x, y + Math.sin(x / 180 + t * 0.4 + y / 90) * 10);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
        frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', size);
        canvas.remove();
    };
}
