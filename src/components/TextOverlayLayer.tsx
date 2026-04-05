/*
Time-filtered text overlays rendered over video, draggable/selectable. 
*/
import { useRef } from "react";
import { useOverlaysStore } from "../stores/overlaysStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { getVideoDisplayRect } from "../utils/cropGeometry";
import type { TextOverlay } from "../types/editor";

interface TextOverlayLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface DragState {
  overlayId: string;
  startX: number;
  startY: number;
  startClientX: number;
  startClientY: number;
}

export default function TextOverlayLayer({
  containerRef,
}: TextOverlayLayerProps) {
  const overlays = useOverlaysStore((s) => s.overlays);
  const selectedOverlayId = useOverlaysStore((s) => s.selectedOverlayId);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const dragRef = useRef<DragState | null>(null);

  const getDisplayRect = () => {
    const container = containerRef.current;
    if (!container) return { left: 0, top: 0, width: 0, height: 0 };
    const { width, height } = container.getBoundingClientRect();
    const { videoWidth, videoHeight } = usePlaybackStore.getState();
    return getVideoDisplayRect(width, height, videoWidth, videoHeight);
  };

  const visibleOverlays = overlays.filter(
    (o) => currentTime >= o.startTime && currentTime <= o.endTime,
  );

  const getOverlayCss = (overlay: TextOverlay) => {
    const rect = getDisplayRect();
    const left = rect.left + overlay.x * rect.width;
    const top = rect.top + overlay.y * rect.height;
    return { left, top };
  };

  const handlePointerDown =
    (overlay: TextOverlay) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      useOverlaysStore.getState().setSelectedOverlay(overlay.id);
      dragRef.current = {
        overlayId: overlay.id,
        startX: overlay.x,
        startY: overlay.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
    };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    // Live preview update: we update the store on move for smooth drag feedback
    const drag = dragRef.current;
    const rect = getDisplayRect();
    if (rect.width === 0 || rect.height === 0) return;
    const normDX = (e.clientX - drag.startClientX) / rect.width;
    const normDY = (e.clientY - drag.startClientY) / rect.height;
    const newX = Math.max(0, Math.min(1, drag.startX + normDX));
    const newY = Math.max(0, Math.min(1, drag.startY + normDY));
    useOverlaysStore
      .getState()
      .updateOverlay(drag.overlayId, { x: newX, y: newY });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      data-testid="text-overlay-layer"
    >
      {visibleOverlays.map((overlay) => {
        const { left, top } = getOverlayCss(overlay);
        const isSelected = overlay.id === selectedOverlayId;
        return (
          <div
            key={overlay.id}
            data-testid={`overlay-${overlay.id}`}
            className="absolute pointer-events-auto select-none cursor-move"
            style={{
              left,
              top,
              fontSize: overlay.fontSize,
              color: overlay.color,
              background: overlay.background,
              padding: "2px 6px",
              borderRadius: 2,
              outline: isSelected ? "2px solid #6366f1" : undefined,
              userSelect: "none",
              whiteSpace: "pre",
            }}
            onPointerDown={handlePointerDown(overlay)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {overlay.content}
          </div>
        );
      })}
    </div>
  );
}
