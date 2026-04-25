// Lightweight WebAudio synth for game SFX. No external assets, no per-frame allocations beyond
// short-lived oscillator nodes (created on demand at hit time only, not per frame).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        return ctx;
    } catch {
        return null;
    }
}

export function unlockAudio() {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => { });
}

export function playSlice(combo = 1) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const baseFreq = 520 + Math.min(combo, 8) * 80;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.4, t0 + 0.08);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);

    // whoosh noise via second osc
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = "sawtooth";
    o2.frequency.setValueAtTime(180, t0);
    o2.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o2.connect(g2).connect(c.destination);
    o2.start(t0);
    o2.stop(t0 + 0.16);
}

export function playBomb() {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.5);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.75);
}

export function playCombo(level: number) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    const f = 660 + level * 90;
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + 0.18);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
}
