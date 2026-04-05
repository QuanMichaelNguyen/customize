---
title: "Video player layout: button and video invisible after upload"
date: "2026-03-29"
category: "ui-bugs"
module: "VideoPlayer / Timeline (Phase 1 playback engine)"
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Play/pause button disappears below viewport after video upload"
  - "Video element present in DOM but not visually rendered"
  - "Canvas timeline renders at wrong scale after multiple resize events"
  - "Timeline drag state stuck on mobile after scroll interrupt"
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - "Canvas rendering (useTimelineRenderer)"
  - "Pointer event handling (Timeline)"
tags:
  - flex-layout
  - min-h-0
  - max-h-full
  - tailwind
  - canvas
  - ctx-settransform
  - pointer-events
  - drag-state
---

# Video player layout: button and video invisible after upload

## Problem

After uploading a video, the play/pause button disappears from view and the video itself is not visible, despite both elements existing in the DOM. Two related Canvas and pointer-event bugs were introduced alongside: the timeline canvas accumulates DPR scale transforms on repeated resize, and touch drag state gets stuck when the browser fires `pointercancel` instead of `pointerup`.

## Symptoms

- Play/pause button visible before video upload, gone after
- `<video>` element in DOM but renders as zero height or is clipped out of view
- Timeline canvas content visually scaled incorrectly after window resize
- Timeline scrubbing continues on mobile after releasing touch (drag state not cleared)
- Seek position on drag-end is a few pixels off from where the user released

## What Didn't Work

- **`max-h-full` on `<video>` directly** — `max-h-full` cannot resolve a percentage when the parent height is derived from the flex algorithm, not an explicit `height` value in the ancestor chain. The video fills its flex item unboundedly, pushing the button below `overflow-hidden`.
- **`max-h-screen` as a substitute** — still does not give the flex child a correct bounded height.
- **`ctx.scale(dpr, dpr)` in ResizeObserver** — scale is multiplicative; assigning `canvas.width` resets the CTM to identity, so the first resize works, but subsequent resizes compound the transform (`dpr^N`).
- **`pointerup`-only drag cleanup** — on mobile, `pointercancel` fires instead of `pointerup` when the OS or browser intercepts a scroll gesture. Without a `pointercancel` handler, `isDraggingRef.current` stays `true` forever.
- **Recomputing seek time from `pointerup.offsetX`** — the browser may report a slightly different `offsetX` on `pointerup` than on the final `pointermove`, producing a few-pixel divergence in seek position.

## Solution

### 1. Flex-constrained video layout

Wrap the `<video>` in a `flex-1 min-h-0` container so it has a resolved height that `h-full` can fill. Keep the button outside the wrapper.

```tsx
// Before
<div className="flex flex-col items-center gap-3 w-full h-full">
  <video className="w-full max-h-full object-contain" ref={videoRef} />
  <button onClick={handlePlayPause}>Play/Pause</button>
</div>

// After
<div className="flex flex-col items-center gap-3 w-full h-full">
  <div className="flex-1 min-h-0 w-full overflow-hidden">
    <video
      ref={videoRef}
      className={`w-full h-full object-contain ${!hasVideo ? 'hidden' : ''}`}
    />
  </div>
  {hasVideo && (
    <button onClick={handlePlayPause}>Play/Pause</button>
  )}
</div>
```

### 2. Absolute DPR transform on canvas resize

Replace `ctx.scale` (multiplicative) with `ctx.setTransform` (absolute) inside the ResizeObserver callback.

```typescript
// Before
ctx.scale(dpr, dpr)

// After
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
```

Full ResizeObserver pattern:

```typescript
const resizeObserver = new ResizeObserver((entries) => {
  const entry = entries[entries.length - 1]  // process only the last entry
  if (!entry) return
  const { width, height } = entry.contentRect
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)  // absolute, never accumulates
})
```

### 3. Handle `pointercancel` to clear drag state

```tsx
const handlePointerCancel = () => {
  // Browser cancelled the pointer (scroll gesture, OS interrupt, etc.)
  isDraggingRef.current = false
}

return (
  <canvas
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerCancel={handlePointerCancel}  // required for mobile
  />
)
```

### 4. Commit seek time from `scrubTimeRef`, not `pointerup.offsetX`

```typescript
const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
  if (!isDraggingRef.current) return
  scrubTimeRef.current = computeTime(e.nativeEvent.offsetX, e.currentTarget.clientWidth)
}

const handlePointerUp = () => {
  isDraggingRef.current = false
  // Commit what scrubTimeRef holds (last pointermove position)
  // rather than recomputing from pointerup.offsetX (can differ by a few px)
  const time = scrubTimeRef.current
  if (videoRef.current) videoRef.current.currentTime = time
  usePlaybackStore.getState().setCurrentTime(time)
}
```

## Why This Works

**Flex + `min-h-0`:** Flexbox's default `min-height: auto` prevents a flex child from shrinking below its natural content size. When the parent's height comes from the flex algorithm (not an explicit `height: Xpx` value), `max-h-full` on the child has nothing to resolve against and is effectively ignored. Adding `min-h-0` overrides the default, letting the wrapper shrink — and `h-full` on the video then fills that bounded wrapper.

**`setTransform` vs `scale`:** 2D canvas transforms are applied cumulatively. `ctx.scale(2, 2)` called three times produces a `8×` transform. `canvas.width = X` resets the CTM to identity, but only if the width value changes. Calling `ctx.setTransform(a, b, c, d, e, f)` replaces the matrix entirely, making it safe to call on every resize.

**`pointercancel` handler:** The Pointer Events API spec requires implementations to fire `pointercancel` when the browser or OS intercepts a pointer (scroll gesture, multitasking switch, focus loss). This event never transitions to `pointerup`. Any code that resets drag state only in `pointerup` will leak that state on mobile.

**`scrubTimeRef` commit pattern:** The RAF loop reads `scrubTimeRef` on every frame; it already holds the most recent user-intended position. Recomputing from `pointerup.offsetX` introduces a second coordinate source that may not match the final visual state the user saw. Using the stored ref produces consistent, predictable seek behavior.

## Prevention

- **Flex + height:** Always pair `flex-1` with `min-h-0` on any flex child that needs its children to fill height. Test the layout at multiple viewport sizes and aspect ratios before shipping.
- **Canvas transforms:** Use `setTransform` for absolute transforms (DPR scaling on resize). Use `scale`/`translate` only for relative adjustments within a single draw cycle. Document the choice.
- **Pointer events:** Implement the full Pointer Events lifecycle: `pointerdown`, `pointermove`, `pointerup`, **and `pointercancel`**. Any drag, resize, or interactive gesture that uses `setPointerCapture` must handle `pointercancel`.
- **Drag ephemeral state:** Write the authoritative value (time, position, delta) to a ref during `pointermove`; commit to store/DOM only on `pointerup`/`pointercancel`. Never recompute from the terminal event's coordinates.

**Vitest regression tests:**

```typescript
// 1. Video and button visible after metadata load
it('shows video and button when metadata loads', () => {
  const videoRef = makeVideoRef()
  render(<VideoPlayer videoRef={videoRef} />)
  const video = document.querySelector('video')!
  fireEvent(video, new Event('loadedmetadata'))
  expect(video.classList.contains('hidden')).toBe(false)
  expect(screen.getByRole('button')).toBeInTheDocument()
})

// 2. Drag state cleared on pointercancel
it('clears isDragging on pointercancel', () => {
  usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
  const videoRef = makeVideoRef()
  render(<Timeline videoRef={videoRef} />)
  const canvas = document.querySelector('canvas')!
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

  dispatchPointer(canvas, 'pointerdown', 100)
  const event = new MouseEvent('pointercancel', { bubbles: true, cancelable: true })
  canvas.dispatchEvent(event)

  // pointermove after cancel should not update scrubTimeRef
  const storeBefore = usePlaybackStore.getState().currentTime
  dispatchPointer(canvas, 'pointermove', 250)
  expect(usePlaybackStore.getState().currentTime).toBe(storeBefore)
})

// 3. pointerup commits last pointermove position, not pointerup offsetX
it('commits last pointermove time on pointerup', () => {
  usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
  const videoRef = makeVideoRef()
  render(<Timeline videoRef={videoRef} />)
  const canvas = document.querySelector('canvas')!
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

  dispatchPointer(canvas, 'pointerdown', 100)
  dispatchPointer(canvas, 'pointermove', 250)  // 250/500 * 100 = 50
  dispatchPointer(canvas, 'pointerup', 300)    // ignored

  expect(usePlaybackStore.getState().currentTime).toBe(50)
})
```

## Related Issues

- `docs/plans/2026-03-28-001-feat-phase1-playback-canvas-timeline-plan.md` — Phase 1 plan that identified these patterns in advance; technical learnings section (lines 37–59) covers DPR scaling, scrub drag, and RAF cleanup.
