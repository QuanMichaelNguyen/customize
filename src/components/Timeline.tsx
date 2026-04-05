/* 
Canvas interaction layer (scrub + trim-handle dragging + commit on up/cancel).
*/
import { useRef, useEffect } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useClipsStore } from "../stores/clipsStore";
import { useAudioStore } from "../stores/audioStore";
import { useTimelineRenderer } from "../hooks/useTimelineRenderer";
import { pixelToTime, timeToPixel } from "../utils/timelineGeometry";
import { LABEL_WIDTH, AUDIO_ROW_Y } from "../utils/laneGeometry";

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const HIT_RADIUS = 8;

export default function Timeline({ videoRef }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const scrubTimeRef = useRef(0);
  const inPointDragRef = useRef<{ clipId: string; time: number } | null>(null);
  const outPointDragRef = useRef<{ clipId: string; time: number } | null>(null);
  const activeDragRef = useRef<{ type: "in" | "out"; clipId: string } | null>(
    null,
  );

  // waveformDataRef is read by the RAF loop directly — avoids re-triggering the useEffect
  // when waveform data loads (consistent with how ephemeral drag refs are handled).
  const waveformDataRef = useRef(useAudioStore.getState().waveformData);
  // Keep waveformDataRef in sync whenever audioStore updates
  useEffect(() => {
    const unsubscribe = useAudioStore.subscribe((state) => {
      waveformDataRef.current = state.waveformData;
    });
    return unsubscribe;
  }, []);

  useTimelineRenderer(
    canvasRef,
    videoRef,
    isDraggingRef,
    scrubTimeRef,
    inPointDragRef,
    outPointDragRef,
    waveformDataRef,
  );

  // User presses the mouse down on timeline bar
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const offsetX = e.nativeEvent.offsetX;
    const offsetY = e.nativeEvent.offsetY;
    const canvasWidth = canvas.clientWidth;
    const { duration } = usePlaybackStore.getState();
    const { clips } = useClipsStore.getState();

    // Ignore clicks inside the label column
    if (offsetX < LABEL_WIDTH) return;

    // Determine which Y band was clicked
    const inVideoRow = offsetY < AUDIO_ROW_Y;

    // Hit-test trim handles only in the video row
    if (inVideoRow) {
      for (const clip of clips) {
        const inX = timeToPixel(
          clip.startTime,
          duration,
          canvasWidth,
          LABEL_WIDTH,
        );
        const outX = timeToPixel(
          clip.endTime,
          duration,
          canvasWidth,
          LABEL_WIDTH,
        );

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
    }

    // Fall through to playhead scrub (both rows)
    canvas.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    scrubTimeRef.current = pixelToTime(
      offsetX,
      duration,
      canvasWidth,
      LABEL_WIDTH,
    );
  };

  // User moves the cursor on the timeline bar
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const offsetX = e.nativeEvent.offsetX;
    const canvasWidth = e.currentTarget.clientWidth;
    const { duration } = usePlaybackStore.getState();

    if (activeDragRef.current) {
      const time = pixelToTime(offsetX, duration, canvasWidth, LABEL_WIDTH);
      const { type, clipId } = activeDragRef.current;
      if (type === "in") {
        inPointDragRef.current = { clipId, time };
      } else {
        outPointDragRef.current = { clipId, time };
      }
      return;
    }

    if (!isDraggingRef.current) return;
    scrubTimeRef.current = pixelToTime(
      offsetX,
      duration,
      canvasWidth,
      LABEL_WIDTH,
    );
  };

  // User releases the cursor
  const handlePointerUp = () => {
    if (activeDragRef.current) {
      const { type, clipId } = activeDragRef.current;
      if (type === "in" && inPointDragRef.current) {
        useClipsStore.getState().setTrimIn(clipId, inPointDragRef.current.time);
        inPointDragRef.current = null;
      } else if (type === "out" && outPointDragRef.current) {
        useClipsStore
          .getState()
          .setTrimOut(clipId, outPointDragRef.current.time);
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
        useClipsStore
          .getState()
          .setTrimOut(clipId, outPointDragRef.current.time);
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
