/*
Global keyboard shortcut handler for the video editor.

Shortcuts:
  K         — toggle play/pause
  L         — play at 1× speed
  J         — pause + step back one frame
  ArrowLeft — pause + step back one frame
  ArrowRight— pause + step forward one frame
  S         — split active clip at current time
  I         — set trim-in of active clip to current time
  O         — set trim-out of active clip to current time
  Ctrl/Cmd+Z           — undo last clip mutation
  Ctrl/Cmd+Shift+Z     — redo
  Ctrl/Cmd+Y           — redo (Windows convention)

Shortcuts do not fire when a text input, textarea, or select element has focus.
*/
import { useEffect } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useClipsStore } from '../stores/clipsStore'
import { useHistoryStore } from '../stores/historyStore'

const FRAME_DURATION = 1 / 30

export function useKeyboardShortcuts(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Do not fire shortcuts when the user is typing in a form field.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      const video = videoRef.current
      const { hasVideo, currentTime, duration } = usePlaybackStore.getState()
      const { clips } = useClipsStore.getState()

      const activeClip = clips.find(
        (c) => currentTime >= c.startTime && currentTime <= c.endTime,
      )

      const splitDisabled =
        !activeClip ||
        currentTime <= activeClip.startTime + 0.1 ||
        currentTime >= activeClip.endTime - 0.1

      const isModifier = e.ctrlKey || e.metaKey

      switch (e.key) {
        case 'k': {
          if (!video || !hasVideo) return
          e.preventDefault()
          if (usePlaybackStore.getState().isPlaying) {
            video.pause()
          } else {
            video.play().catch((err: unknown) => {
              if (err instanceof DOMException && err.name === 'AbortError') return
              throw err
            })
          }
          break
        }

        case 'l': {
          if (!video || !hasVideo) return
          e.preventDefault()
          usePlaybackStore.getState().setPlaybackRate(1)
          video.playbackRate = 1
          video.play().catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') return
            throw err
          })
          break
        }

        case 'j':
        case 'ArrowLeft': {
          if (!video || !hasVideo) return
          e.preventDefault()
          video.pause()
          video.currentTime = Math.max(0, video.currentTime - FRAME_DURATION)
          usePlaybackStore.getState().setCurrentTime(video.currentTime)
          break
        }

        case 'ArrowRight': {
          if (!video || !hasVideo) return
          e.preventDefault()
          video.pause()
          video.currentTime = Math.min(duration, video.currentTime + FRAME_DURATION)
          usePlaybackStore.getState().setCurrentTime(video.currentTime)
          break
        }

        case 's': {
          if (!hasVideo || splitDisabled || !activeClip) return
          e.preventDefault()
          useHistoryStore.getState().push(clips)
          useClipsStore.getState().splitClip(activeClip.id, currentTime)
          break
        }

        case 'i': {
          if (!hasVideo || !activeClip) return
          e.preventDefault()
          useHistoryStore.getState().push(clips)
          useClipsStore.getState().setTrimIn(activeClip.id, currentTime)
          break
        }

        case 'o': {
          if (!hasVideo || !activeClip) return
          e.preventDefault()
          useHistoryStore.getState().push(clips)
          useClipsStore.getState().setTrimOut(activeClip.id, currentTime)
          break
        }

        case 'z': {
          if (!isModifier) return
          e.preventDefault()
          if (e.shiftKey) {
            useHistoryStore.getState().redo()
          } else {
            useHistoryStore.getState().undo()
          }
          break
        }

        case 'y': {
          if (!isModifier) return
          e.preventDefault()
          useHistoryStore.getState().redo()
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [videoRef])
}
