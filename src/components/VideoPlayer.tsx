/* 
File load, video metadata/play-pause sync, state resets, 
waveform extraction kickoff, crop/text overlay layer host.
*/
import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useClipsStore } from "../stores/clipsStore";
import { useCropStore } from "../stores/cropStore";
import { useOverlaysStore } from "../stores/overlaysStore";
import { useTracksStore } from "../stores/tracksStore";
import { useAudioStore } from "../stores/audioStore";
import { useHistoryStore } from "../stores/historyStore";
import { extractWaveform } from "../utils/extractWaveform";
import CropOverlay from "./CropOverlay";
import TextOverlayLayer from "./TextOverlayLayer";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function VideoPlayer({ videoRef }: VideoPlayerProps) {
  const blobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);
  const setVideoMetadata = usePlaybackStore((s) => s.setVideoMetadata);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const initDefaultClip = useClipsStore((s) => s.initDefaultClip);
  const isCropOverlayOpen = useCropStore((s) => s.isCropOverlayOpen);
  const toggleCropOverlay = useCropStore((s) => s.toggleCropOverlay);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoMetadata({
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
      initDefaultClip(video.duration);
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    let lastStoreUpdate = -Infinity;
    const handleTimeUpdate = () => {
      const now = performance.now();
      if (now - lastStoreUpdate < 100) return;
      lastStoreUpdate = now;
      usePlaybackStore.getState().setCurrentTime(video.currentTime);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [videoRef, setVideoMetadata, setPlaying, initDefaultClip]); // if any of these dependency changed, useEffect got trigger again

  // Sync tracksStore audio track muted/volume to the video element imperatively.
  // We cannot use JSX `muted` attribute — React silently ignores it on re-renders (React #6544).
  useEffect(() => {
    return useTracksStore.subscribe((state) => {
      const video = videoRef.current;
      if (!video) return;
      const audioTrack = state.tracks.find((t) => t.id === "audio-0");
      if (!audioTrack) return;
      video.muted = audioTrack.muted;
      video.volume = audioTrack.volume;
    });
  }, [videoRef]);

  // Sync playbackStore.playbackRate to the video element imperatively.
  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = state.playbackRate;
    });
  }, [videoRef]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;

    useHistoryStore.getState().clear();
    useClipsStore.getState().reset();
    useCropStore.getState().reset();
    useOverlaysStore.getState().reset();
    useTracksStore.getState().reset();
    useAudioStore.getState().reset();

    useTracksStore.getState().addTrack({
      id: "video-0",
      type: "video",
      label: "Video",
      muted: false,
      volume: 1,
    });

    // Free the old memory by revoking the old URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    videoRef.current.src = url;

    // Kick off async waveform extraction
    useAudioStore.getState().setLoading();
    extractWaveform(file, 2000)
      .then((data) => {
        useAudioStore.getState().setWaveform(data);
        if (data !== null) {
          useTracksStore.getState().addTrack({
            id: "audio-0",
            type: "audio",
            label: "Audio",
            muted: false,
            volume: 1,
          });
        }
      })
      .catch(() => {
        useAudioStore.getState().setError();
      });
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="text-sm text-gray-300"
      />
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden"
      >
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${!hasVideo ? "hidden" : ""}`}
        />
        {hasVideo && isCropOverlayOpen && (
          <CropOverlay containerRef={containerRef} />
        )}
        {hasVideo && <TextOverlayLayer containerRef={containerRef} />}
      </div>
      {hasVideo && (
        <div className="flex gap-2">
          <button
            onClick={handlePlayPause}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={toggleCropOverlay}
            className={`px-4 py-2 rounded ${
              isCropOverlayOpen
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            Crop
          </button>
        </div>
      )}
    </div>
  );
}
