import { useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import { usePlaybackStore } from "./stores/playbackStore";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);

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

      {/* Timeline strip */}
      <div className="h-20 bg-gray-800 border-t border-gray-700 px-2 py-3">
        <Timeline videoRef={videoRef} />
      </div>
    </div>
  );
}
