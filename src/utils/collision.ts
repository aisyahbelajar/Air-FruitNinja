export function segmentCircleHit(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    r: number,
): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        const ddx = cx - x1;
        const ddy = cy - y1;
        return ddx * ddx + ddy * ddy <= r * r;
    }
    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const ex = cx - px;
    const ey = cy - py;
    return ex * ex + ey * ey <= r * r;
}
