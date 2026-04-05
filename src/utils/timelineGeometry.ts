export function pixelToTime(offsetX: number, duration: number, canvasWidth: number): number {
    if (duration <= 0 || canvasWidth <= 0) return 0
    return Math.max(0, Math.min((offsetX / canvasWidth) * duration, duration))
}

export function timeToPixel(time: number, duration: number, canvasWidth: number): number {
    if (duration <= 0) return 0
    return (time / duration) * canvasWidth
}