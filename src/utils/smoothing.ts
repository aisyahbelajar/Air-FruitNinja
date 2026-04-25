export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export interface Point {
    x: number;
    y: number;
}

export function smoothPoint(prev: Point, current: Point, factor = 0.35): Point {
    return {
        x: lerp(prev.x, current.x, factor),
        y: lerp(prev.y, current.y, factor),
    };
}
