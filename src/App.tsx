import { useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import OverlayStylePanel from "./components/OverlayStylePanel";
import { usePlaybackStore } from "./stores/playbackStore";
import { useClipsStore } from "./stores/clipsStore";
import { useOverlaysStore } from "./stores/overlaysStore";
import { useTracksStore } from "./stores/tracksStore";
import { useAudioStore } from "./stores/audioStore";
import { LABEL_WIDTH, VIDEO_ROW_HEIGHT, AUDIO_ROW_HEIGHT } from "./utils/laneGeometry";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const clips = useClipsStore((s) => s.clips);
  const selectedOverlayId = useOverlaysStore((s) => s.selectedOverlayId);
  const tracks = useTracksStore((s) => s.tracks);
  const extractionStatus = useAudioStore((s) => s.extractionStatus);
  const videoTrack = tracks.find((t) => t.id === "video-0");
  const audioTrack = tracks.find((t) => t.id === "audio-0");

  useKeyboardShortcuts(videoRef);

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

      {/* Timeline strip — two rows: video track + audio track */}
      <div
        className="flex-shrink-0 bg-gray-800 border-t border-gray-700 flex min-h-0"
        style={{ height: VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT }}
      >
        {/* DOM label column — per-track labels and controls (filled by Unit 7) */}
        <div className="flex flex-col flex-shrink-0" style={{ width: LABEL_WIDTH }}>
          {/* Video track label row */}
          <div
            className="flex items-center px-2 border-b border-gray-700 text-xs text-gray-400 select-none"
            style={{ height: VIDEO_ROW_HEIGHT }}
          >
            {videoTrack ? videoTrack.label : "Video"}
          </div>
          {/* Audio track label row */}
          <div
            className="flex flex-col justify-center px-2 text-xs select-none gap-0.5"
            style={{ height: AUDIO_ROW_HEIGHT }}
            data-testid="audio-label-row"
          >
            {extractionStatus === "loading" ? (
              <span className="text-gray-500 animate-pulse">Audio…</span>
            ) : audioTrack ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate">{audioTrack.label}</span>
                  <button
                    data-testid="mute-btn"
                    onClick={() =>
                      useTracksStore.getState().setMuted("audio-0", !audioTrack.muted)
                    }
                    className="text-gray-400 hover:text-white leading-none"
                    title={audioTrack.muted ? "Unmute" : "Mute"}
                  >
                    {audioTrack.muted ? "🔇" : "🔊"}
                  </button>
                </div>
                <input
                  data-testid="volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={audioTrack.volume}
                  onChange={(e) =>
                    useTracksStore.getState().setVolume("audio-0", Number(e.target.value))
                  }
                  className="w-full h-1 accent-indigo-400"
                />
              </>
            ) : (
              <span className="text-gray-600">No audio</span>
            )}
          </div>
        </div>

        {/* Canvas area — occupies remaining width */}
        <div className="flex-1 min-w-0">
          <Timeline videoRef={videoRef} />
        </div>
      </div>
    </div>
  );
}
