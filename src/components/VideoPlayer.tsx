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
import { useSourceStore } from "../stores/sourceStore";
import { useExportStore } from "../stores/exportStore";
import { useHistoryStore } from "../stores/historyStore";
import { extractWaveform } from "../utils/extractWaveform";
import { saveVideoFile, loadVideoFile } from "../utils/videoPersistence";
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
      const existingClip = useClipsStore.getState().clips.find(
        (c) => c.trackId === "video-0",
      );
      if (existingClip) {
        // Restore trim state from the persisted clip.
        // Pass real file duration so videoDuration is set correctly,
        // then applyTrim overwrites duration with the trimmed range.
        setVideoMetadata({
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        usePlaybackStore.getState().applyTrim(existingClip.startTime, existingClip.endTime);
        video.currentTime = existingClip.startTime;
      } else {
        setVideoMetadata({
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        initDefaultClip(video.duration);
      }
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    let lastStoreUpdate = -Infinity;
    const handleTimeUpdate = () => {
      // Enforce clip boundaries — always unthrottled
      const { trimOffset } = usePlaybackStore.getState();
      const { clips } = useClipsStore.getState();
      const videoClip = clips.find((c) => c.trackId === "video-0");
      if (videoClip) {
        // clip.startTime/endTime are real video timestamps (not rebased)
        if (video.currentTime >= videoClip.endTime) {
          video.pause();
          video.currentTime = videoClip.startTime;
          usePlaybackStore.getState().setPlaying(false);
          usePlaybackStore.getState().setCurrentTime(0);
          lastStoreUpdate = -Infinity;
          return;
        }
        if (video.currentTime < videoClip.startTime) {
          video.currentTime = videoClip.startTime;
        }
      }

      const now = performance.now();
      if (now - lastStoreUpdate < 100) return;
      lastStoreUpdate = now;
      usePlaybackStore.getState().setCurrentTime(video.currentTime - trimOffset);
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

  // Restore persisted video from IndexedDB on mount (survives page reload).
  // Tracks are persisted via localStorage (tracksStore), so we only add a track
  // if it isn't already there — this preserves the user's mute/volume settings.
  useEffect(() => {
    loadVideoFile()
      .then((file) => {
        if (!file || !videoRef.current) return;

        const url = URL.createObjectURL(file);
        blobUrlRef.current = url;
        videoRef.current.src = url;
        useSourceStore.getState().setFile(file);

        const existingTracks = useTracksStore.getState().tracks;
        if (!existingTracks.some((t) => t.id === "video-0")) {
          useTracksStore.getState().addTrack({
            id: "video-0",
            type: "video",
            label: "Video",
            muted: false,
            volume: 1,
          });
        }

        useAudioStore.getState().setLoading();
        extractWaveform(file, 2000)
          .then((data) => {
            useAudioStore.getState().setWaveform(data);
            if (data !== null) {
              const tracks = useTracksStore.getState().tracks;
              if (!tracks.some((t) => t.id === "audio-0")) {
                useTracksStore.getState().addTrack({
                  id: "audio-0",
                  type: "audio",
                  label: "Audio",
                  muted: false,
                  volume: 1,
                });
              }
            }
          })
          .catch(() => {
            useAudioStore.getState().setError();
          });
      })
      .catch(() => {
        // IDB unavailable or empty — start fresh, no action needed
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    useSourceStore.getState().reset();
    useExportStore.getState().resetExport();

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
    useSourceStore.getState().setFile(file);
    saveVideoFile(file).catch(() => {/* IDB unavailable, proceed without persistence */});

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
