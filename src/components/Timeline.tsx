import { useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useClipsStore } from "../stores/clipsStore";
import { useTimelineRenderer } from "../hooks/useTimelineRenderer";
import { pixelToTime, timeToPixel } from "../utils/timelineGeometry";

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const HIT_RADIUS = 8;

export default function Timeline({ videoRef }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const scrubTimeRef = useRef(0);
  const inPointDragRef = useRef<{ clipId: string; time: number } | null>(null);
  const outPointDragRef = useRef<{ clipId: string; time: number } | null>(null);
  const activeDragRef = useRef<{ type: "in" | "out"; clipId: string } | null>(null);

  useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef, inPointDragRef, outPointDragRef);

  // User presses the mouse down on timeline bar
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const offsetX = e.nativeEvent.offsetX;
    const canvasWidth = canvas.clientWidth;
    const { duration } = usePlaybackStore.getState();
    const { clips } = useClipsStore.getState();

    // Hit-test handles first — in-point takes priority over out-point when both overlap
    for (const clip of clips) {
      const inX = timeToPixel(clip.startTime, duration, canvasWidth);
      const outX = timeToPixel(clip.endTime, duration, canvasWidth);

      if (Math.abs(offsetX - inX) <= HIT_RADIUS) {
        canvas.setPointerCapture(e.pointerId);
        activeDragRef.current = { type: "in", clipId: clip.id };
        inPointDragRef.current = { clipId: clip.id, time: clip.startTime };
        return;
      }
      if (Math.abs(offsetX - outX) <= HIT_RADIUS) {
        canvas.setPointerCapture(e.pointerId);
        activeDragRef.current = { type: "out", clipId: clip.id };
        outPointDragRef.current = { clipId: clip.id, time: clip.endTime };
        return;
      }
    }

    // Fall through to playhead scrub
    canvas.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    scrubTimeRef.current = pixelToTime(offsetX, duration, canvasWidth);
  };

  // User moves the cursor on the timeline bar
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const offsetX = e.nativeEvent.offsetX;
    const canvasWidth = e.currentTarget.clientWidth;
    const { duration } = usePlaybackStore.getState();

    if (activeDragRef.current) {
      const time = pixelToTime(offsetX, duration, canvasWidth);
      const { type, clipId } = activeDragRef.current;
      if (type === "in") {
        inPointDragRef.current = { clipId, time };
      } else {
        outPointDragRef.current = { clipId, time };
      }
      return;
    }

    if (!isDraggingRef.current) return;
    scrubTimeRef.current = pixelToTime(offsetX, duration, canvasWidth);
  };

  // User releases the cursor
  const handlePointerUp = () => {
    if (activeDragRef.current) {
      const { type, clipId } = activeDragRef.current;
      if (type === "in" && inPointDragRef.current) {
        useClipsStore.getState().setTrimIn(clipId, inPointDragRef.current.time);
        inPointDragRef.current = null;
      } else if (type === "out" && outPointDragRef.current) {
        useClipsStore.getState().setTrimOut(clipId, outPointDragRef.current.time);
        outPointDragRef.current = null;
      }
      activeDragRef.current = null;
      return;
    }

    isDraggingRef.current = false;
    const time = scrubTimeRef.current;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    usePlaybackStore.getState().setCurrentTime(time);
  };

  // Browser cancels the pointer (e.g. mobile scroll interrupt) — commit last known drag value
  const handlePointerCancel = () => {
    if (activeDragRef.current) {
      const { type, clipId } = activeDragRef.current;
      if (type === "in" && inPointDragRef.current) {
        useClipsStore.getState().setTrimIn(clipId, inPointDragRef.current.time);
        inPointDragRef.current = null;
      } else if (type === "out" && outPointDragRef.current) {
        useClipsStore.getState().setTrimOut(clipId, outPointDragRef.current.time);
        outPointDragRef.current = null;
      }
      activeDragRef.current = null;
      return;
    }

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
