import { useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import OverlayStylePanel from "./components/OverlayStylePanel";
import { usePlaybackStore } from "./stores/playbackStore";
import { useClipsStore } from "./stores/clipsStore";
import { useOverlaysStore } from "./stores/overlaysStore";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const clips = useClipsStore((s) => s.clips);
  const selectedOverlayId = useOverlaysStore((s) => s.selectedOverlayId);

  const activeClip = clips.find(
    (c) => currentTime >= c.startTime && currentTime <= c.endTime,
  );
  const splitDisabled =
    !activeClip ||
    currentTime <= activeClip.startTime + 0.1 ||
    currentTime >= activeClip.endTime - 0.1;

  const handleSplit = () => {
    if (!activeClip) return;
    useClipsStore.getState().splitClip(activeClip.id, currentTime);
  };

  const handleAddText = () => {
    const startTime = Math.max(0, currentTime - 2.5);
    const endTime = Math.min(duration, currentTime + 2.5);
    const id = crypto.randomUUID();
    useOverlaysStore.getState().addOverlay({
      id,
      content: 'Text',
      startTime,
      endTime,
      x: 0.5,
      y: 0.5,
      fontSize: 24,
      color: '#ffffff',
      background: 'rgba(0,0,0,0.5)',
    });
    useOverlaysStore.getState().setSelectedOverlay(id);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Video preview area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {!hasVideo && (
          <p className="text-gray-500 text-lg select-none">
            Load a video to get started
          </p>
        )}
        <VideoPlayer videoRef={videoRef} />
      </div>

      {/* Editor controls bar */}
      {hasVideo && (
        <div className="flex items-center justify-center gap-3 py-2 bg-gray-800 border-t border-gray-700">
          <button
            onClick={handleSplit}
            disabled={splitDisabled}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Split
          </button>
          <button
            data-testid="add-text-btn"
            onClick={handleAddText}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Add Text
          </button>
        </div>
      )}

      {/* Overlay style panel — shown when an overlay is selected */}
      {hasVideo && selectedOverlayId && <OverlayStylePanel />}

      {/* Timeline strip */}
      <div className="h-20 bg-gray-800 border-t border-gray-700 px-2 py-3">
        <Timeline videoRef={videoRef} />
      </div>
    </div>
  );
}
