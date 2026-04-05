import { useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import { usePlaybackStore } from "./stores/playbackStore";
import { useClipsStore } from "./stores/clipsStore";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const clips = useClipsStore((s) => s.clips);

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
        </div>
      )}

      {/* Timeline strip */}
      <div className="h-20 bg-gray-800 border-t border-gray-700 px-2 py-3">
        <Timeline videoRef={videoRef} />
      </div>
    </div>
  );
}
