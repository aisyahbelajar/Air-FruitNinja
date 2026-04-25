import { useEffect, useRef, useState, useCallback } from "react";
import { useHandTracking } from "../hooks/useHandTracking";
import { smoothPoint } from "../utils/smoothing";
import { segmentCircleHit } from "../utils/collision";
import { spawnFruit, createParticles, type Fruit, type Particle } from "../utils/spawnFruits";
import { unlockAudio, playSlice, playBomb, playCombo } from "../utils/audio";

const TRAIL_MAX = 18;
const COMBO_WINDOW = 700; // ms between hits to keep combo alive

interface TrailPoint {
    x: number;
    y: number;
    ts: number;
}

interface GameState {
    fruits: Fruit[];
    particles: Particle[];
    trail: TrailPoint[];
    finger: { x: number; y: number };
    prevFinger: { x: number; y: number };
    fingerInit: boolean;
    fingerSpeed: number;
    sliceFlash: number; // 0..1 fades after a slice
    lastSpawn: number;
    spawnInterval: number;
    shake: number;
    score: number;
    scoreDisplay: number;
    scorePulse: number; // 0..1 fades
    combo: number;
    comboTs: number;
    comboFlash: number; // 0..1 fades when combo bumps
    slowMo: number; // 1 = normal, <1 = slowed
    gameOver: boolean;
    running: boolean;
    width: number;
    height: number;
    dpr: number;
    startTs: number;
}

export default function FruitGame() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const previewVideoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const { fingerRef, status, errorMsg } = useHandTracking(videoRef);

    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [best, setBest] = useState<number>(() => {
        if (typeof window === "undefined") return 0;
        return parseInt(localStorage.getItem("afn_best") || "0", 10);
    });
    const [gameOver, setGameOver] = useState(false);
    const [started, setStarted] = useState(false);

    const stateRef = useRef<GameState>({
        fruits: [],
        particles: [],
        trail: [],
        finger: { x: 0, y: 0 },
        prevFinger: { x: 0, y: 0 },
        fingerInit: false,
        fingerSpeed: 0,
        sliceFlash: 0,
        lastSpawn: 0,
        spawnInterval: 900,
        shake: 0,
        score: 0,
        scoreDisplay: 0,
        scorePulse: 0,
        combo: 0,
        comboTs: 0,
        comboFlash: 0,
        slowMo: 1,
        gameOver: false,
        running: false,
        width: 0,
        height: 0,
        dpr: 1,
        startTs: 0,
    });

    // Mirror the camera stream into the visible preview <video> once ready.
    useEffect(() => {
        if (status !== "ready") return;
        const main = videoRef.current;
        const prev = previewVideoRef.current;
        if (!main || !prev) return;
        if (main.srcObject && prev.srcObject !== main.srcObject) {
            prev.srcObject = main.srcObject;
            prev.play().catch(() => { });
        }
    }, [status]);

    const resetGame = useCallback(() => {
        unlockAudio();
        const s = stateRef.current;
        s.fruits.length = 0;
        s.particles.length = 0;
        s.trail.length = 0;
        s.score = 0;
        s.scoreDisplay = 0;
        s.scorePulse = 0;
        s.combo = 0;
        s.comboTs = 0;
        s.comboFlash = 0;
        s.slowMo = 1;
        s.shake = 0;
        s.gameOver = false;
        s.running = true;
        s.lastSpawn = 0;
        s.spawnInterval = 900;
        s.startTs = performance.now();
        setScore(0);
        setCombo(0);
        setGameOver(false);
        setStarted(true);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = container.getBoundingClientRect();
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            const s = stateRef.current;
            s.width = rect.width;
            s.height = rect.height;
            s.dpr = dpr;
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        window.addEventListener("orientationchange", resize);
        return () => {
            ro.disconnect();
            window.removeEventListener("orientationchange", resize);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
        } as CanvasRenderingContext2DSettings);
        if (!ctx) return;

        let rafId = 0;
        let lastReactScore = 0;
        let lastReactCombo = 0;
        let lastReactSync = 0;

        const drawFruit = (f: Fruit) => {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation);
            ctx.shadowColor = f.type === "bomb" ? "rgba(255,71,87,0.6)" : "rgba(0,0,0,0.4)";
            ctx.shadowBlur = f.type === "bomb" ? 22 : 14;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = f.color.fill;
            ctx.beginPath();
            ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.lineWidth = 3;
            ctx.strokeStyle = f.color.stroke;
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            ctx.beginPath();
            ctx.arc(-f.radius * 0.35, -f.radius * 0.35, f.radius * 0.35, 0, Math.PI * 2);
            ctx.fill();

            if (f.type === "bomb") {
                ctx.fillStyle = "#ff4757";
                ctx.beginPath();
                ctx.arc(0, -f.radius - 6, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#ffffff";
                ctx.font = `bold ${Math.floor(f.radius)}px system-ui`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", 0, 2);
            }
            ctx.restore();
        };

        const drawTrail = (trail: TrailPoint[], flash: number) => {
            if (trail.length < 2) return;
            const now = performance.now();
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalCompositeOperation = "lighter";
            // Cyan -> red flash mix
            const r = Math.floor(125 + (255 - 125) * flash);
            const g = Math.floor(211 + (80 - 211) * flash);
            const b = Math.floor(252 + (90 - 252) * flash);
            for (let i = 1; i < trail.length; i++) {
                const a = trail[i - 1];
                const bp = trail[i];
                const age = (now - bp.ts) / 280;
                const alpha = Math.max(0, 1 - age);
                if (alpha <= 0) continue;
                // Outer glow
                ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
                ctx.lineWidth = 18 * alpha + 4;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(bp.x, bp.y);
                ctx.stroke();
                // Core line
                ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
                ctx.lineWidth = 4 * alpha + 1.5;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(bp.x, bp.y);
                ctx.stroke();
            }
            ctx.restore();
        };

        const drawPointer = (x: number, y: number, speed: number, flash: number) => {
            const baseR = 9;
            const r = baseR + Math.min(8, speed * 0.04);
            const r2 = Math.floor(125 + (255 - 125) * flash);
            const g2 = Math.floor(211 + (80 - 211) * flash);
            const b2 = Math.floor(252 + (90 - 252) * flash);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            // outer glow
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
            grad.addColorStop(0, `rgba(${r2},${g2},${b2},0.7)`);
            grad.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // core
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r2},${g2},${b2},0.95)`;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.stroke();
        };

        const loop = (now: number) => {
            const s = stateRef.current;
            const dpr = s.dpr;
            const W = s.width;
            const H = s.height;

            // Ease slow-mo back to normal
            s.slowMo += (1 - s.slowMo) * 0.04;
            const dt = s.slowMo;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            if (s.shake > 0) {
                const shakeX = (Math.random() - 0.5) * s.shake;
                const shakeY = (Math.random() - 0.5) * s.shake;
                s.shake *= 0.88;
                if (s.shake < 0.3) s.shake = 0;
                ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
            }

            // Decay flashes / pulses
            s.sliceFlash *= 0.88;
            if (s.sliceFlash < 0.01) s.sliceFlash = 0;
            s.scorePulse *= 0.9;
            if (s.scorePulse < 0.01) s.scorePulse = 0;
            s.comboFlash *= 0.9;
            if (s.comboFlash < 0.01) s.comboFlash = 0;

            // Combo timeout
            if (s.combo > 0 && now - s.comboTs > COMBO_WINDOW) {
                s.combo = 0;
            }

            const finger = fingerRef.current;
            const fingerVisible = finger.visible && now - finger.ts < 400;
            if (fingerVisible && W > 0 && H > 0) {
                const target = { x: finger.x * W, y: finger.y * H };
                if (!s.fingerInit) {
                    s.finger = { ...target };
                    s.prevFinger = { ...target };
                    s.fingerInit = true;
                } else {
                    s.prevFinger = { ...s.finger };
                    s.finger = smoothPoint(s.finger, target, 0.4);
                }
                const dx = s.finger.x - s.prevFinger.x;
                const dy = s.finger.y - s.prevFinger.y;
                const inst = Math.sqrt(dx * dx + dy * dy);
                s.fingerSpeed = s.fingerSpeed * 0.7 + inst * 0.3;
                s.trail.push({ x: s.finger.x, y: s.finger.y, ts: now });
                if (s.trail.length > TRAIL_MAX) s.trail.shift();
            } else {
                if (s.trail.length > 0) s.trail.shift();
                s.fingerSpeed *= 0.85;
            }

            if (s.running && !s.gameOver) {
                const elapsed = (now - s.startTs) / 1000;
                const difficulty = 1 + Math.min(4, elapsed / 18);
                s.spawnInterval = Math.max(340, 900 - elapsed * 9);
                if (now - s.lastSpawn > s.spawnInterval) {
                    s.lastSpawn = now;
                    const burst = Math.random() < 0.25 + Math.min(0.25, elapsed / 60) ? 2 : 1;
                    for (let i = 0; i < burst; i++) {
                        s.fruits.push(spawnFruit(W, H, difficulty));
                    }
                }

                for (let i = s.fruits.length - 1; i >= 0; i--) {
                    const f = s.fruits[i];
                    f.vy += f.gravity * dt;
                    f.x += f.vx * dt;
                    f.y += f.vy * dt;
                    f.rotation += f.rotationSpeed * dt;
                    if (f.y - f.radius > H + 80) {
                        s.fruits.splice(i, 1);
                        continue;
                    }

                    if (fingerVisible && s.fingerInit && !f.sliced) {
                        const hit = segmentCircleHit(
                            s.prevFinger.x,
                            s.prevFinger.y,
                            s.finger.x,
                            s.finger.y,
                            f.x,
                            f.y,
                            f.radius,
                        );
                        if (hit) {
                            f.sliced = true;
                            s.sliceFlash = 1;
                            if (f.type === "bomb") {
                                const bigParts = createParticles(f.x, f.y, "#ff4757", 40);
                                for (const p of bigParts) s.particles.push(p);
                                s.shake = 32;
                                s.gameOver = true;
                                s.running = false;
                                playBomb();
                                setGameOver(true);
                                const finalScore = s.score;
                                setBest((prev) => {
                                    if (finalScore > prev) {
                                        try {
                                            localStorage.setItem("afn_best", String(finalScore));
                                        } catch {
                                            // ignore
                                        }
                                        return finalScore;
                                    }
                                    return prev;
                                });
                            } else {
                                // Combo
                                if (now - s.comboTs < COMBO_WINDOW) {
                                    s.combo += 1;
                                } else {
                                    s.combo = 1;
                                }
                                s.comboTs = now;
                                const points = 1 + Math.max(0, s.combo - 1);
                                s.score += points;
                                s.scorePulse = 1;
                                s.comboFlash = 1;
                                const partColor = f.color.fill;
                                const parts = createParticles(f.x, f.y, partColor, 18 + Math.min(s.combo, 6) * 2);
                                for (const p of parts) s.particles.push(p);
                                if (s.combo >= 3) {
                                    playCombo(s.combo);
                                    if (s.combo === 3 || s.combo === 5 || s.combo === 7) {
                                        s.shake = Math.min(20, 8 + s.combo);
                                        s.slowMo = 0.45; // brief slow-mo for big combo
                                    }
                                } else {
                                    playSlice(s.combo);
                                }
                            }
                            s.fruits.splice(i, 1);
                        }
                    }
                }
            }

            for (let i = s.particles.length - 1; i >= 0; i--) {
                const p = s.particles[i];
                p.vy += 0.25 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= p.decay;
                if (p.life <= 0) s.particles.splice(i, 1);
            }

            // Draw fruits with hit-pop scale (sliced ones already removed; we pop via radius briefly using rotationSpeed already; keep simple)
            for (let i = 0; i < s.fruits.length; i++) drawFruit(s.fruits[i]);

            // Particles with additive glow
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < s.particles.length; i++) {
                const p = s.particles[i];
                const a = Math.max(0, p.life);
                ctx.globalAlpha = a;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            drawTrail(s.trail, s.sliceFlash);

            if (fingerVisible && s.fingerInit) {
                drawPointer(s.finger.x, s.finger.y, s.fingerSpeed, s.sliceFlash);
            }

            // Animated displayed score
            s.scoreDisplay += (s.score - s.scoreDisplay) * 0.25;

            // Throttled React sync
            if (now - lastReactSync > 70) {
                lastReactSync = now;
                const dispScore = Math.round(s.scoreDisplay);
                if (dispScore !== lastReactScore) {
                    lastReactScore = dispScore;
                    setScore(dispScore);
                }
                if (s.combo !== lastReactCombo) {
                    lastReactCombo = s.combo;
                    setCombo(s.combo);
                }
            }

            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [fingerRef]);

    const handleStart = () => {
        resetGame();
    };

    const showCameraPreview = status === "ready";

    return (
        <div className="game-root" onPointerDown={unlockAudio}>
            <div ref={containerRef} className="game-stage">
                <video ref={videoRef} className="hidden-video" playsInline muted />
                <canvas ref={canvasRef} className="game-canvas" />

                {showCameraPreview && (
                    <div className="cam-preview" aria-hidden>
                        <video ref={previewVideoRef} playsInline muted />
                        <span className="cam-label">Camera Preview</span>
                    </div>
                )}

                <div className="hud">
                    <div className={`hud-pill score ${combo >= 2 ? "pulsing" : ""}`}>
                        <span className="hud-label">SCORE</span>
                        <span className="hud-value">{score}</span>
                    </div>
                    <div className="hud-pill subtle">
                        <span className="hud-label">BEST</span>
                        <span className="hud-value">{best}</span>
                    </div>
                    {combo >= 2 && (
                        <div key={combo} className="combo-chip">
                            Combo ×{combo}
                        </div>
                    )}
                </div>

                <div className={`hand-status ${status}`}>
                    <span className="status-dot" />
                    {status === "loading" && "Loading hand tracking…"}
                    {status === "ready" && "Tracking active"}
                    {status === "idle" && "Initializing…"}
                    {status === "denied" && "Camera blocked"}
                    {status === "error" && "Camera error"}
                </div>

                {!started && status === "ready" && (
                    <Overlay
                        title="Air Fruit Ninja"
                        subtitle="Slice fruit with your index finger. Avoid the bombs."
                        buttonLabel="Start Game"
                        onClick={handleStart}
                    />
                )}
                {!started && status !== "ready" && status !== "denied" && status !== "error" && (
                    <Overlay
                        title="Air Fruit Ninja"
                        subtitle="Allow camera access to play. Loading hand tracking…"
                        loading
                    />
                )}
                {(status === "denied" || status === "error") && (
                    <Overlay
                        title="Camera Required"
                        subtitle={errorMsg || "Enable camera permissions and reload the page to play."}
                        buttonLabel="Reload"
                        onClick={() => window.location.reload()}
                    />
                )}
                {gameOver && (
                    <Overlay
                        title="Game Over"
                        subtitle={`You scored ${score} ${score === 1 ? "point" : "points"}.`}
                        buttonLabel="Play Again"
                        onClick={handleStart}
                        stat={`Best: ${best}`}
                    />
                )}
            </div>

            <style>{`
        .game-root {
          width: 100vw;
          height: 100vh;
          background:
            radial-gradient(circle at 20% 10%, rgba(56,189,248,0.12) 0%, transparent 50%),
            radial-gradient(circle at 80% 90%, rgba(168,85,247,0.12) 0%, transparent 50%),
            radial-gradient(circle at 50% 0%, #1e293b 0%, #020617 70%);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          color: #f1f5f9;
        }
        .game-stage {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 1280px;
          max-height: 100vh;
        }
        .hidden-video {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
        .game-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(2,6,23,0.6) 100%);
        }
        .cam-preview {
          position: absolute;
          bottom: 18px;
          right: 18px;
          width: 200px;
          aspect-ratio: 4 / 3;
          border-radius: 14px;
          overflow: hidden;
          opacity: 0.7;
          box-shadow:
            0 10px 30px -10px rgba(0,0,0,0.7),
            0 0 0 1px rgba(125,211,252,0.25),
            0 0 24px -6px rgba(56,189,248,0.45);
          pointer-events: none;
          z-index: 6;
          background: #000;
        }
        .cam-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
          display: block;
        }
        .cam-label {
          position: absolute;
          bottom: 6px;
          left: 8px;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(241,245,249,0.85);
          background: rgba(2,6,23,0.55);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .hud {
          position: absolute;
          top: 20px;
          left: 20px;
          display: flex;
          gap: 10px;
          z-index: 5;
          align-items: center;
        }
        .hud-pill {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(148, 163, 184, 0.2);
          padding: 8px 14px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          letter-spacing: 0.08em;
          transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
        }
        .hud-pill.score.pulsing {
          border-color: rgba(125,211,252,0.7);
          box-shadow: 0 0 18px -2px rgba(56,189,248,0.55);
          transform: scale(1.04);
        }
        .hud-pill.subtle { opacity: 0.75; }
        .hud-label {
          font-weight: 600;
          color: #94a3b8;
          font-size: 11px;
        }
        .hud-value {
          font-weight: 700;
          font-size: 18px;
          color: #f8fafc;
          font-variant-numeric: tabular-nums;
        }
        .combo-chip {
          background: linear-gradient(135deg, rgba(56,189,248,0.9), rgba(168,85,247,0.9));
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.08em;
          padding: 8px 14px;
          border-radius: 999px;
          box-shadow: 0 0 22px -4px rgba(168,85,247,0.7);
          animation: comboPop 0.35s ease-out;
        }
        @keyframes comboPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .hand-status {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          letter-spacing: 0.05em;
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(148,163,184,0.2);
          backdrop-filter: blur(10px);
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 8px currentColor;
        }
        .hand-status.ready { color: #6ee7b7; border-color: rgba(110,231,183,0.4); }
        .hand-status.loading, .hand-status.idle { color: #fcd34d; }
        .hand-status.denied, .hand-status.error { color: #fca5a5; }

        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          padding: 20px;
        }
        .overlay-card {
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 20px;
          padding: 40px;
          max-width: 440px;
          text-align: center;
          box-shadow: 0 30px 80px -20px rgba(0,0,0,0.6), 0 0 60px -20px rgba(56,189,248,0.4);
          animation: cardIn 0.35s ease-out;
        }
        @keyframes cardIn {
          from { transform: translateY(10px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .overlay-title {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 12px;
          background: linear-gradient(90deg, #f8fafc, #94a3b8);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: -0.02em;
        }
        .overlay-sub {
          color: #cbd5e1;
          margin: 0 0 20px;
          font-size: 15px;
          line-height: 1.5;
        }
        .overlay-stat {
          color: #fcd34d;
          font-weight: 700;
          margin-bottom: 16px;
          font-size: 14px;
          letter-spacing: 0.05em;
        }
        .overlay-btn {
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          color: white;
          border: 0;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 700;
          border-radius: 12px;
          cursor: pointer;
          letter-spacing: 0.05em;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 10px 30px -10px rgba(99,102,241,0.6);
        }
        .overlay-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px -10px rgba(99,102,241,0.8);
        }
        .overlay-btn:active { transform: translateY(0); }
        .overlay-tip {
          color: #64748b;
          font-size: 12px;
          margin: 18px 0 0;
        }
        .spinner {
          width: 32px;
          height: 32px;
          margin: 8px auto 16px;
          border: 3px solid rgba(148,163,184,0.2);
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .cam-preview { width: 120px; bottom: 12px; right: 12px; }
        }
      `}</style>
        </div>
    );
}

interface OverlayProps {
    title: string;
    subtitle: string;
    buttonLabel?: string;
    onClick?: () => void;
    loading?: boolean;
    stat?: string;
}

function Overlay({ title, subtitle, buttonLabel, onClick, loading, stat }: OverlayProps) {
    return (
        <div className="overlay">
            <div className="overlay-card">
                <h1 className="overlay-title">{title}</h1>
                <p className="overlay-sub">{subtitle}</p>
                {stat && <div className="overlay-stat">{stat}</div>}
                {loading && <div className="spinner" />}
                {buttonLabel && (
                    <button
                        className="overlay-btn"
                        onClick={() => {
                            unlockAudio();
                            onClick?.();
                        }}
                    >
                        {buttonLabel}
                    </button>
                )}
                <p className="overlay-tip">
                    Tip: Hold your hand ~50cm from the camera. Use your index finger.
                </p>
            </div>
        </div>
    );
}
