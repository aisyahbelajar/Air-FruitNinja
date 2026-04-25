export interface FruitColor {
    fill: string;
    stroke: string;
    name: string;
}

export interface Fruit {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    gravity: number;
    rotation: number;
    rotationSpeed: number;
    type: "fruit" | "bomb";
    color: FruitColor;
    sliced: boolean;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    decay: number;
    size: number;
    color: string;
}

const FRUIT_COLORS: FruitColor[] = [
    { fill: "#ff4757", stroke: "#c0392b", name: "watermelon" },
    { fill: "#feca57", stroke: "#f39c12", name: "lemon" },
    { fill: "#1dd1a1", stroke: "#10ac84", name: "lime" },
    { fill: "#ff6b81", stroke: "#e84393", name: "strawberry" },
    { fill: "#ff9f43", stroke: "#e17055", name: "orange" },
    { fill: "#a29bfe", stroke: "#6c5ce7", name: "grape" },
];

export function spawnFruit(canvasWidth: number, canvasHeight: number, difficulty = 1): Fruit {
    const isBomb = Math.random() < 0.12;
    const x = canvasWidth * (0.15 + Math.random() * 0.7);
    const y = canvasHeight + 40;
    const targetHeight = canvasHeight * (0.15 + Math.random() * 0.25);
    const gravity = 0.45 + difficulty * 0.05;
    const vy = -Math.sqrt(2 * gravity * (canvasHeight - targetHeight));
    const vx = (Math.random() - 0.5) * 6;
    const radius = 36 + Math.random() * 14;
    const color: FruitColor = isBomb
        ? { fill: "#2d3436", stroke: "#000000", name: "bomb" }
        : FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];

    return {
        x,
        y,
        vx,
        vy,
        radius,
        gravity,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        type: isBomb ? "bomb" : "fruit",
        color,
        sliced: false,
    };
}

export function createParticles(x: number, y: number, color: string, count = 14): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            size: 3 + Math.random() * 4,
            color,
        });
    }
    return particles;
}
