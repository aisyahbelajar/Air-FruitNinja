import { useEffect, useRef, useState, type RefObject } from "react";

export interface FingerState {
    x: number;
    y: number;
    visible: boolean;
    ts: number;
}

export type HandStatus = "idle" | "loading" | "ready" | "denied" | "error";

function loadScript(src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.crossOrigin = "anonymous";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

export function useHandTracking(videoRef: RefObject<HTMLVideoElement | null>) {
    const fingerRef = useRef<FingerState>({ x: 0.5, y: 0.5, visible: false, ts: 0 });
    const [status, setStatus] = useState<HandStatus>("idle");
    const [errorMsg, setErrorMsg] = useState<string>("");

    useEffect(() => {
        let stream: MediaStream | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let hands: any = null;
        let rafId: number | null = null;
        let cancelled = false;

        async function init() {
            setStatus("loading");
            try {
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
                if (cancelled) return;

                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" },
                    audio: false,
                });
                if (cancelled) return;

                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await new Promise<void>((res) => {
                    video.onloadedmetadata = () => {
                        video.play().then(() => res()).catch(() => res());
                    };
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const HandsCtor = (window as any).Hands;
                hands = new HandsCtor({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
                });
                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.5,
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                hands.onResults((results: any) => {
                    const lm = results.multiHandLandmarks?.[0];
                    if (lm && lm[8]) {
                        fingerRef.current = {
                            x: 1 - lm[8].x,
                            y: lm[8].y,
                            visible: true,
                            ts: performance.now(),
                        };
                    } else {
                        fingerRef.current = {
                            ...fingerRef.current,
                            visible: false,
                            ts: performance.now(),
                        };
                    }
                });

                setStatus("ready");

                let busy = false;
                const tick = async () => {
                    if (cancelled) return;
                    if (!busy && video.readyState >= 2) {
                        busy = true;
                        try {
                            await hands.send({ image: video });
                        } catch {
                            // swallow per-frame errors
                        }
                        busy = false;
                    }
                    rafId = requestAnimationFrame(tick);
                };
                rafId = requestAnimationFrame(tick);
            } catch (err: unknown) {
                console.error("Hand tracking init failed:", err);
                const e = err as { name?: string; message?: string };
                if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
                    setStatus("denied");
                    setErrorMsg("Camera permission was denied.");
                } else {
                    setStatus("error");
                    setErrorMsg(e?.message || "Failed to initialize camera.");
                }
            }
        }

        init();

        return () => {
            cancelled = true;
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (hands) {
                try {
                    hands.close();
                } catch {
                    // ignore
                }
            }
            if (stream) {
                stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            }
        };
    }, [videoRef]);

    return { fingerRef, status, errorMsg };
}
