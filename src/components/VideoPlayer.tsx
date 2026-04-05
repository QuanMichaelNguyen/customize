import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useClipsStore } from "../stores/clipsStore";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export default function VideoPlayer({ videoRef }: VideoPlayerProps) {
  const blobUrlRef = useRef<string | null>(null);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const hasVideo = usePlaybackStore((s) => s.hasVideo);
  const setVideoMetadata = usePlaybackStore((s) => s.setVideoMetadata);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const initDefaultClip = useClipsStore((s) => s.initDefaultClip);

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

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [videoRef, setVideoMetadata, setPlaying, initDefaultClip]); // if any of these dependency changed, useEffect got trigger again

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

    // Free the old memory by revoking the old URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    videoRef.current.src = url;
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
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${!hasVideo ? "hidden" : ""}`}
        />
      </div>
      {hasVideo && (
        <button
          onClick={handlePlayPause}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      )}
    </div>
  );
}
