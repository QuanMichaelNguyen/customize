import { useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useTimelineRenderer } from "../hooks/useTimelineRenderer";

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export default function Timeline({ videoRef }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const scrubTimeRef = useRef(0);

  useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef);

  const computeTime = (offsetX: number, canvasWidth: number): number => {
    const duration = usePlaybackStore.getState().duration;
    if (duration <= 0 || canvasWidth <= 0) return 0;
    const ratio = offsetX / canvasWidth;
    return Math.max(0, Math.min(ratio * duration, duration));
  };

  // User presses the mouse down on timeline bar
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    scrubTimeRef.current = computeTime(
      e.nativeEvent.offsetX,
      e.currentTarget.clientWidth,
    );
  };

  // User move the cursor on the timeline bar
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    scrubTimeRef.current = computeTime(
      e.nativeEvent.offsetX,
      e.currentTarget.clientWidth,
    );
  };

  // User release the cursor
  const handlePointerUp = () => {
    isDraggingRef.current = false;
    const time = scrubTimeRef.current;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    usePlaybackStore.getState().setCurrentTime(time);
  };

  // Browser cancel the movement of cursor
  const handlePointerCancel = () => {
    isDraggingRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
