import { useRef } from "react";
import { useCropStore } from "../stores/cropStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { getVideoDisplayRect } from "../utils/cropGeometry";
import type { CropRegion, AspectRatioPreset } from "../types/editor";

interface CropOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

type Corner = "tl" | "tr" | "bl" | "br";

interface DragState {
  corner: Corner;
  startRegion: CropRegion;
  startClientX: number;
  startClientY: number;
  region: CropRegion;
}

const MIN_CROP_SIZE = 0.05;

function computeNewRegion(
  corner: Corner,
  start: CropRegion,
  normDX: number,
  normDY: number,
): CropRegion {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let { x, y, width, height } = start;

  if (corner === "tl") {
    x = Math.max(0, Math.min(start.x + normDX, right - MIN_CROP_SIZE));
    y = Math.max(0, Math.min(start.y + normDY, bottom - MIN_CROP_SIZE));
    width = right - x;
    height = bottom - y;
  } else if (corner === "tr") {
    y = Math.max(0, Math.min(start.y + normDY, bottom - MIN_CROP_SIZE));
    width = Math.max(MIN_CROP_SIZE, Math.min(start.width + normDX, 1 - start.x));
    height = bottom - y;
  } else if (corner === "bl") {
    x = Math.max(0, Math.min(start.x + normDX, right - MIN_CROP_SIZE));
    width = right - x;
    height = Math.max(MIN_CROP_SIZE, Math.min(start.height + normDY, 1 - start.y));
  } else {
    // br
    width = Math.max(MIN_CROP_SIZE, Math.min(start.width + normDX, 1 - start.x));
    height = Math.max(MIN_CROP_SIZE, Math.min(start.height + normDY, 1 - start.y));
  }

  return { x, y, width, height };
}

const PRESETS: AspectRatioPreset[] = ["16:9", "9:16", "1:1", "free"];

export default function CropOverlay({ containerRef }: CropOverlayProps) {
  const cropRegion = useCropStore((s) => s.cropRegion);
  const aspectRatio = useCropStore((s) => s.aspectRatio);
  const cropDragRef = useRef<DragState | null>(null);

  const getDisplayRect = () => {
    const container = containerRef.current;
    if (!container) return { left: 0, top: 0, width: 0, height: 0 };
    const { width, height } = container.getBoundingClientRect();
    const { videoWidth, videoHeight } = usePlaybackStore.getState();
    return getVideoDisplayRect(width, height, videoWidth, videoHeight);
  };

  // Compute CSS crop box positions
  const displayRect = getDisplayRect();
  const cssLeft = cropRegion ? displayRect.left + cropRegion.x * displayRect.width : 0;
  const cssTop = cropRegion ? displayRect.top + cropRegion.y * displayRect.height : 0;
  const cssWidth = cropRegion ? cropRegion.width * displayRect.width : 0;
  const cssHeight = cropRegion ? cropRegion.height * displayRect.height : 0;

  const handleCornerPointerDown =
    (corner: Corner) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!cropRegion) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      cropDragRef.current = {
        corner,
        startRegion: cropRegion,
        startClientX: e.clientX,
        startClientY: e.clientY,
        region: cropRegion,
      };
    };

  const handleCornerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const rect = getDisplayRect();
    const normDX = rect.width > 0 ? (e.clientX - drag.startClientX) / rect.width : 0;
    const normDY = rect.height > 0 ? (e.clientY - drag.startClientY) / rect.height : 0;
    drag.region = computeNewRegion(drag.corner, drag.startRegion, normDX, normDY);
  };

  const commitDrag = () => {
    const drag = cropDragRef.current;
    if (!drag) return;
    useCropStore.getState().setCropRegion(drag.region);
    cropDragRef.current = null;
  };

  const cornerClass =
    "absolute w-3 h-3 bg-white border border-gray-400 pointer-events-auto";

  return (
    <div className="absolute inset-0 pointer-events-none" data-testid="crop-overlay">
      {cropRegion && (
        <>
          {/* Dark regions outside the crop box */}
          <div
            className="absolute bg-black/50 pointer-events-none"
            style={{ left: 0, top: 0, right: 0, height: cssTop }}
          />
          <div
            className="absolute bg-black/50 pointer-events-none"
            style={{ left: 0, top: cssTop + cssHeight, right: 0, bottom: 0 }}
          />
          <div
            className="absolute bg-black/50 pointer-events-none"
            style={{ left: 0, top: cssTop, width: cssLeft, height: cssHeight }}
          />
          <div
            className="absolute bg-black/50 pointer-events-none"
            style={{
              left: cssLeft + cssWidth,
              top: cssTop,
              right: 0,
              height: cssHeight,
            }}
          />

          {/* Crop box with corner handles */}
          <div
            data-testid="crop-box"
            className="absolute border-2 border-emerald-400 pointer-events-none"
            style={{ left: cssLeft, top: cssTop, width: cssWidth, height: cssHeight }}
          >
            <div
              data-testid="corner-tl"
              className={`${cornerClass} -top-1.5 -left-1.5 cursor-nw-resize`}
              onPointerDown={handleCornerPointerDown("tl")}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
            />
            <div
              data-testid="corner-tr"
              className={`${cornerClass} -top-1.5 -right-1.5 cursor-ne-resize`}
              onPointerDown={handleCornerPointerDown("tr")}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
            />
            <div
              data-testid="corner-bl"
              className={`${cornerClass} -bottom-1.5 -left-1.5 cursor-sw-resize`}
              onPointerDown={handleCornerPointerDown("bl")}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
            />
            <div
              data-testid="corner-br"
              className={`${cornerClass} -bottom-1.5 -right-1.5 cursor-se-resize`}
              onPointerDown={handleCornerPointerDown("br")}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
            />
          </div>
        </>
      )}

      {/* Preset buttons — always visible when overlay is open */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-auto">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            data-testid={`preset-${preset}`}
            onClick={() => useCropStore.getState().setAspectRatio(preset)}
            className={`px-2 py-1 text-xs rounded ${
              aspectRatio === preset
                ? "bg-emerald-500 text-white"
                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
            }`}
          >
            {preset === "free" ? "Free" : preset}
          </button>
        ))}
      </div>
    </div>
  );
}
