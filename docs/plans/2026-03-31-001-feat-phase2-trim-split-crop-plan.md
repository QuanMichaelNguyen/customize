---
title: "feat: Phase 2 — Trimming, Splitting, and Cropping"
type: feat
status: active
date: 2026-03-31
deepened: 2026-03-31
---

# feat: Phase 2 — Trimming, Splitting, and Cropping

## Overview

Phase 2 adds three editing primitives on top of the Phase 1 playback engine: drag handles on the canvas timeline for in/out trim points, a split-at-playhead action that cuts a clip into two, and a DOM-based crop overlay on the video preview with aspect ratio presets. All state (trim points, crop region) is stored in Zustand; all ephemeral drag deltas live in refs.

## Problem Frame

Phase 1 delivered a playback engine and a scrubbing timeline. The editor is now a viewer — it cannot yet define what portion of a clip to keep or how to frame the shot. Phase 2 gives users the first real editorial controls: deciding where a clip starts and ends (trim), cutting a clip at a point in time (split), and framing the output shot (crop). These three features are the foundation of every subsequent export operation in Phase 6.

## Requirements Trace

- R1. User can drag a left (in-point) handle on the timeline to set the clip start time
- R2. User can drag a right (out-point) handle on the timeline to set the clip end time
- R3. In-point and out-point always maintain a minimum separation; dragging one past the other is rejected
- R4. A split button cuts the active clip at the current playhead position into two clips
- R5. Split is disabled when the playhead is at a clip boundary (zero-length result)
- R6. User can open a crop overlay on the video preview and drag a rectangular crop region
- R7. Crop overlay offers preset buttons: 16:9, 9:16, 1:1; selecting a preset snaps the crop region to the correct aspect ratio centered on the current region
- R8. Crop region is expressed in normalized coordinates (0–1 relative to the video frame) so it is resolution-independent
- R9. All drag interactions handle `pointercancel` to avoid stuck handles on mobile/tablet
- R10. The canvas timeline renders at 60fps during handle drags without Zustand writes per frame

## Scope Boundaries

- No per-track trim — single implied track; multi-track is Phase 4
- No undo/redo — deferred to a future phase
- No waveform visualization — Phase 4
- No timeline zoom — Phase 5
- No ffmpeg export of trim/crop — Phase 6
- Multiple clips after split are represented in `clipsStore` but the timeline renders all handles for all clips; there is no "active clip" selection UI in this phase
- Crop region does not animate or keyframe — single static value
- Text overlays are Phase 3

## Context & Research

### Relevant Code and Patterns

- `src/components/Timeline.tsx` — pointer event handling, `setPointerCapture`, four-handler drag pattern (`pointerdown/move/up/cancel`)
- `src/hooks/useTimelineRenderer.ts` — RAF loop, `cancelledRef` guard, `ResizeObserver` + `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, store reads via `.getState()` snapshot
- `src/stores/playbackStore.ts` — flat state + actions pattern, `State & Actions` merged type, curried `create<T>()((set, get) => ...)`
- `src/stores/clipsStore.ts` — already has `ClipSegment[]` with `startTime`/`endTime`; Phase 2 extends this, does not restructure it
- `src/types/editor.ts` — `ClipSegment`, `VideoMetadata` interfaces; Phase 2 adds `CropRegion` and `AspectRatioPreset`
- `src/App.tsx` — wiring layer; calls both stores when video metadata loads; `videoRef` always passed as prop

### Institutional Learnings

- `docs/solutions/ui-bugs/video-player-layout-invisible-elements-2026-03-29.md` — **`pointercancel` must be handled from the start** on all canvas drag interactions; omitting it leaves handles stuck on mobile scroll interrupts
- Same solution doc: **commit from ref, not from terminal event coordinates** — `pointerup.offsetX` can differ by a few pixels from the last `pointermove.offsetX`; always commit the ref value
- Same solution doc: **`ctx.setTransform` not `ctx.scale`** — `ctx.scale` accumulates across ResizeObserver callbacks and produces `dpr^N` zoom; use `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` (absolute)
- Phase 1 plan: `canvas.clientWidth` (CSS px) is the correct divisor for time math; `canvas.width` (physical px) would produce wrong results on high-DPI screens

### External References

- None used — all patterns are well-established in Phase 1 codebase

## Key Technical Decisions

- **Trim in/out points are `startTime`/`endTime` on `ClipSegment`, not global playback state:** `ClipSegment` already has these fields. A default clip spanning `[0, duration]` is created when video loads. This is consistent with the multi-clip future (Phase 4) and avoids parallel state on `playbackStore`. (see CLAUDE.md: "clip segments Zustand store shape should be defined but not wired to UI yet" — Phase 2 wires it)

- **Default clip is initialized in `App.tsx`, not inside either store:** Stores do not communicate with each other. `App.tsx` calls `clipsStore.initDefaultClip(duration)` in the same handler that calls `playbackStore.setVideoMetadata`. This is consistent with the established `videoRef`-as-prop wiring pattern.

- **Trim handles are canvas-drawn primitives, not DOM elements:** CLAUDE.md: "Never use DOM manipulation to drive the Canvas timeline." Handles are drawn in the RAF loop; hit-testing for drag initiation happens in `pointerdown` by comparing pixel distance from handle x-position.

- **Crop overlay is a DOM element, not a canvas:** The crop overlay sits over `<video>`, not the timeline. It needs CSS-positioned corner drag handles, which are naturally DOM-friendly. A second canvas for crop would require its own RAF loop and ResizeObserver with no benefit over DOM for a single static rectangle.

- **Crop coordinates are normalized (0–1 relative to video frame dimensions):** Video is displayed with `object-fit: contain`, so the `<video>` element's bounding box may include letterbox/pillarbox areas. Normalized coordinates decouple crop data from display resolution and simplify the Phase 6 ffmpeg conversion.

- **`src/utils/timelineGeometry.ts` is extracted as a shared utility:** Both playhead scrubbing and trim handle drag need `pixelToTime` / `timeToPixel`. Extracting a shared utility eliminates duplication and gives both a single test surface. `Timeline.tsx` is updated to use it.

- **`cropStore` is a separate Zustand store from `playbackStore`:** Crop state has its own lifecycle (user can clear it, change presets, it is not related to playback position). Merging it into `playbackStore` would violate the "flat and action-focused" principle.

- **Handle hit radius is 8 CSS pixels:** 8px is wide enough for a precise mouse cursor and narrow enough that two handles 16px apart (representing ~0.8s on a 10s/200px canvas) remain individually targetable. For touch, where finger width is ~44px, trim handle interaction will sometimes be imprecise — this is acceptable for Phase 2, with a note to increase to 12–16px if user testing shows problems. Rejected alternatives: 4px (too small for mouse precision clicks near the handle edge); 16px (overlapping handles within 32px become impossible to distinguish, which is common after a split at a nearby point).

## Open Questions

### Resolved During Planning

- **Should trim handles show for all clips after a split, or only for the first?** Show for all clips. After a split, both clips' handles are drawn on the timeline. Users interact with whichever handle they click near. This requires no "active clip" selection UI and is consistent with a multi-clip future.

- **What is the minimum clip duration?** 0.1 seconds (100ms). Trim drags and split operations that would produce a clip shorter than 100ms are rejected (handle snaps back). This prevents zero-length clips that would corrupt a future ffmpeg export.

- **Does the crop overlay have a toggle?** Yes — a "Crop" button in the player controls area shows/hides the overlay. The button appears only when a video is loaded. This state (`isCropOverlayOpen: boolean`) lives in `cropStore`.

- **Which dimension wins when an aspect-ratio preset is applied?** Width is authoritative: new height = current width ÷ (width/height ratio). If the resulting height exceeds `1 - cropRegion.y`, reduce height to the available space and back-compute width. Rationale: users typically set a crop width first (framing left/right), so preserving width and adjusting height feels less surprising. Rejected alternative: height-authoritative (would change the horizontal framing users just set); rejected: scale-to-fit both dimensions (moves the region origin, disorienting).

### Deferred to Implementation

- **Exact letter/pillarbox math for mapping crop overlay screen coordinates to video-normalized coordinates:** Requires reading `getBoundingClientRect()` on the video element and computing the displayed video rect within it. The approach is clear; exact pixel values depend on the video's display layout.

- **How to handle re-initialization when the user loads a second video:** Whether to reset `clipsStore` and `cropStore` on new video load, and exactly where to call the resets. Follows the same pattern as `playbackStore.reset()` but the exact call site and ordering depend on runtime observation.

- **Exact IDs for clips created by split:** Whether to use `crypto.randomUUID()`, a counter, or a timestamp. Any deterministic unique ID scheme works; the exact choice is deferred.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### State and data flow

```mermaid
flowchart TD
    VideoLoad["Video loads (loadedmetadata)"]
    AppWiring["App.tsx wiring"]
    PlaybackStore["playbackStore\n(currentTime, duration,\nvideoWidth, videoHeight)"]
    ClipsStore["clipsStore\n(clips: ClipSegment[]\n  startTime, endTime, id, trackId)"]
    CropStore["cropStore\n(cropRegion, aspectRatio,\nisCropOverlayOpen)"]

    VideoLoad --> AppWiring
    AppWiring -->|setVideoMetadata| PlaybackStore
    AppWiring -->|initDefaultClip(duration)| ClipsStore

    subgraph Timeline Canvas
        PointerDown["pointerdown\nhit-test: handle vs scrub"]
        HandleDrag["trim drag\ninPointDragRef / outPointDragRef"]
        PointerUp["pointerup / pointercancel\ncommit to clipsStore"]
        RAF["RAF loop\nreads .getState() + drag refs\ndraws handles at 60fps"]
    end

    PointerDown --> HandleDrag
    HandleDrag --> PointerUp
    PointerUp -->|setTrimIn / setTrimOut| ClipsStore
    RAF -->|reads| ClipsStore
    RAF -->|reads ephemeral| HandleDrag

    SplitBtn["Split button"]
    SplitBtn -->|splitClip(id, currentTime)| ClipsStore
    PlaybackStore -->|currentTime| SplitBtn

    subgraph Crop Overlay DOM
        CropToggle["Crop button (toggle)"]
        CropDrag["corner drag\ncropDragRef"]
        PresetBtn["preset buttons\n16:9 / 9:16 / 1:1"]
    end

    CropToggle -->|setIsCropOverlayOpen| CropStore
    CropDrag -->|setCropRegion| CropStore
    PresetBtn -->|setAspectRatio + setCropRegion| CropStore
    PlaybackStore -->|videoWidth, videoHeight| CropDrag
```

### Handle hit-testing priority

When `pointerdown` fires on the timeline canvas, the handler checks (in order):

1. Is `offsetX` within 8px of any clip's in-point x? → initiate in-point drag for that clip
2. Is `offsetX` within 8px of any clip's out-point x? → initiate out-point drag for that clip
3. Otherwise → initiate playhead scrub (existing behavior)

This preserves Phase 1 scrub behavior as the default and adds trim handle drag without breaking existing pointer logic.

## Implementation Units

- [ ] **Unit 1: Timeline geometry utility**

**Goal:** Extract shared time↔pixel math into a dedicated utility module, update Timeline.tsx to use it, and establish the test surface before it is used by trim handles.

**Requirements:** R10 (shared math prevents per-component duplication that would cause 60fps inconsistencies)

**Dependencies:** None

**Files:**
- Create: `src/utils/timelineGeometry.ts`
- Modify: `src/components/Timeline.tsx` (replace inline `computeTime` with utility)
- Test: `src/utils/__tests__/timelineGeometry.test.ts`

**Approach:**
- Export `pixelToTime(x: number, duration: number, canvasWidth: number): number` — clamps result to `[0, duration]`
- Export `timeToPixel(time: number, duration: number, canvasWidth: number): number` — returns CSS pixel position
- Both functions guard against `duration === 0` by returning `0`
- Use `canvas.clientWidth` (CSS px) as `canvasWidth` everywhere — never `canvas.width`
- `Timeline.tsx`: replace the inline `computeTime` arrow function with a call to `pixelToTime`

**Patterns to follow:**
- `src/components/Timeline.tsx` — existing inline `computeTime` logic is the source of truth for the extracted behavior

**Test scenarios:**
- Happy path: `pixelToTime(100, 10, 200)` → `5` (midpoint of a 10s video on a 200px canvas)
- Happy path: `timeToPixel(5, 10, 200)` → `100`
- Edge case: `pixelToTime(0, 10, 200)` → `0`; `pixelToTime(200, 10, 200)` → `10`
- Edge case: `timeToPixel(0, 10, 200)` → `0`; `timeToPixel(10, 10, 200)` → `200`
- Edge case: `pixelToTime(-20, 10, 200)` → `0` (negative x clamps to 0)
- Edge case: `pixelToTime(300, 10, 200)` → `10` (x beyond canvas clamps to duration)
- Edge case: `pixelToTime(100, 0, 200)` → `0` (duration = 0, no divide-by-zero)
- Edge case: `timeToPixel(5, 0, 200)` → `0` (duration = 0, no divide-by-zero)

**Verification:**
- All test scenarios pass
- `Timeline.tsx` uses `pixelToTime` from the utility; the inline `computeTime` is gone
- `npm run typecheck` and `npm run lint` pass

---

- [ ] **Unit 2: Clip store extension — trim, split, and default clip initialization**

**Goal:** Extend `clipsStore` with `initDefaultClip`, `setTrimIn`, `setTrimOut`, and `splitClip` actions. Add `CropRegion` and `AspectRatioPreset` types in preparation for Unit 5.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None (pure store work; no rendering yet)

**Files:**
- Modify: `src/stores/clipsStore.ts`
- Modify: `src/types/editor.ts`
- Modify: `src/App.tsx` (call `initDefaultClip(duration)` alongside `setVideoMetadata`)
- Test: `src/stores/__tests__/clipsStore.test.ts`

**Approach:**
- `initDefaultClip(duration: number)`: clears existing clips and adds one clip with `startTime: 0`, `endTime: duration`, unique `id`, `trackId: 'video-0'`; called from `App.tsx`'s `loadedmetadata` handler
- `setTrimIn(id: string, time: number)`: updates `startTime` for the matching clip; rejects (no-op) if `time >= clip.endTime - 0.1`
- `setTrimOut(id: string, time: number)`: updates `endTime`; rejects if `time <= clip.startTime + 0.1`
- `splitClip(id: string, atTime: number)`: guards `atTime` is at least 0.1s from both `startTime` and `endTime`; removes original clip; adds two clips: `[startTime, atTime]` and `[atTime, endTime]` with new unique IDs
- Store action shape follows the existing `set()` pattern — no `get()` needed except for `splitClip` which reads the clip being split
- New types in `src/types/editor.ts`: `CropRegion { x: number; y: number; width: number; height: number }` (all values 0–1 normalized) and `AspectRatioPreset = '16:9' | '9:16' | '1:1' | 'free'`

**Patterns to follow:**
- `src/stores/playbackStore.ts` — `State & Actions` interface pattern, flat state, `create<T>()((set, get) => ...)`
- `src/stores/clipsStore.ts` existing structure — extend, do not restructure

**Test scenarios:**
- Happy path: `initDefaultClip(30)` → store has exactly one clip with `startTime: 0`, `endTime: 30`, `trackId: 'video-0'`
- Happy path: after `initDefaultClip(30)`, `setTrimIn(id, 5)` → clip `startTime` is `5`
- Happy path: `setTrimOut(id, 25)` → clip `endTime` is `25`
- Happy path: `splitClip(id, 15)` on clip `[0, 30]` → two clips: `[0, 15]` and `[15, 30]` with distinct IDs
- Edge case: `setTrimIn(id, 28)` on clip with `endTime: 28.05` → no-op (would violate 100ms minimum); clip unchanged
- Edge case: `setTrimOut(id, 5.05)` on clip with `startTime: 5` → no-op; clip unchanged
- Edge case: `splitClip(id, 0.05)` on clip starting at `0` → no-op (split point within 100ms of start); clip count unchanged
- Edge case: `splitClip(id, 29.95)` on clip ending at `30` → no-op (split point within 100ms of end)
- Edge case: `splitClip(id, 99)` where clip ends at `30` → no-op (atTime outside clip range)
- Edge case: `setTrimIn` with unknown ID → no-op, no crash
- Integration: `initDefaultClip` called twice in sequence → store holds exactly one clip (second call replaces first)

**Verification:**
- All test scenarios pass
- `App.tsx` calls `initDefaultClip(duration)` in the `loadedmetadata` event handler after `setVideoMetadata`
- `npm run typecheck` and `npm run lint` pass

---

- [ ] **Unit 3: Trim handle canvas rendering**

**Goal:** Update `useTimelineRenderer` to draw in-point and out-point handles for all clips, reading from `clipsStore` for committed positions and from ephemeral drag refs (passed as arguments) for live-drag positions.

**Requirements:** R1, R2, R10

**Dependencies:** Unit 1 (uses `timeToPixel`), Unit 2 (reads from extended `clipsStore`)

**Files:**
- Modify: `src/hooks/useTimelineRenderer.ts`
- Test: `src/hooks/__tests__/useTimelineRenderer.test.ts`

**Approach:**
- Hook signature gains two new ref arguments: `inPointDragRef: React.RefObject<{clipId: string; time: number} | null>` and `outPointDragRef: React.RefObject<{clipId: string; time: number} | null>`
- In the RAF loop, after drawing the playhead, loop over `useClipsStore.getState().clips` and for each clip:
  - Compute in-point x from `inPointDragRef.current?.clipId === clip.id ? inPointDragRef.current.time : clip.startTime`, then `timeToPixel`
  - Compute out-point x similarly with `outPointDragRef`
  - Draw in-point handle: vertical line in a distinct color (suggested: `#10b981` emerald-500) with a small grip indicator at top
  - Draw out-point handle: vertical line in the same color
  - Draw the "kept" region between in-point and out-point as a slightly lighter overlay on the timeline track
- Handle color should be visually distinct from the playhead (`#f9fafb`) and the progress fill (`#6366f1`)
- All draw calls use CSS pixel coordinates (`clientWidth`, `clientHeight`); DPR is handled by `setTransform` in `ResizeObserver`

**Patterns to follow:**
- `src/hooks/useTimelineRenderer.ts` — existing playhead draw loop, `usePlaybackStore.getState()` pattern, `cancelledRef` guard
- `src/utils/timelineGeometry.ts` (Unit 1) — use `timeToPixel` for x-position computation

**Test scenarios:**
- Happy path: with one clip `[2, 8]` on a 10s video and 200px canvas, in-point handle is drawn at x=40 and out-point at x=160
- Happy path: with `inPointDragRef.current = {clipId, time: 3}`, RAF loop draws in-point at x=60 (drag position), not x=40 (store position)
- Happy path: with `outPointDragRef.current = {clipId, time: 7}`, RAF loop draws out-point at x=140
- Happy path: after `splitClip` produces two clips `[0,15]` and `[15,30]` on a 30s, 300px canvas — four handles drawn at x=0, x=150, x=150, x=300 (handles at split point overlap)
- Edge case: with no clips in store → timeline renders without handles, no crash
- Edge case: with `duration: 0` → handles are not drawn (guard against divide-by-zero via `timeToPixel`)
- Integration: after `setTrimIn` updates store, next RAF frame (triggered manually in test) draws in-point at the updated position

**Verification:**
- All test scenarios pass
- RAF loop reads handle positions from drag refs when set, falls back to store values when null
- No Zustand writes occur inside the RAF loop
- `npm run typecheck` and `npm run lint` pass

---

- [ ] **Unit 4: Trim handle drag interaction and split button**

**Goal:** Add pointer-event hit-testing and drag logic for in/out handles in `Timeline.tsx`, and add a split button to the editor controls that calls `splitClip` at the current playhead position.

**Requirements:** R1, R2, R3, R4, R5, R9, R10

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `src/components/Timeline.tsx`
- Modify: `src/App.tsx` (add split button to editor chrome)
- Test: `src/components/__tests__/Timeline.test.tsx`

**Approach:**
- In `Timeline.tsx`, add `inPointDragRef` and `outPointDragRef` (each `React.useRef<{clipId: string; time: number} | null>(null)`) and an `activeDragRef` tracking which handle (if any) is being dragged
- Pass both drag refs to `useTimelineRenderer` (Unit 3 signature)
- `pointerdown` handler: compute handle x-positions for all clips; if `offsetX` is within 8px of an in-point x, set `activeDragRef` to `'in'` + `clipId`, call `setPointerCapture`; if within 8px of out-point, use `'out'`; otherwise fall through to existing scrub logic
- `pointermove` handler: if `activeDragRef` is set, update the matching drag ref with `{clipId, time: pixelToTime(offsetX, duration, canvas.clientWidth)}`; otherwise run existing scrub logic
- `pointerup` handler: if `activeDragRef` is set, call `setTrimIn` or `setTrimOut` with the drag ref's value, clear drag ref and `activeDragRef`; otherwise run existing scrub logic
- `pointercancel` handler: same as `pointerup` for handles (commit last known position, clear drag state)
- Split button: add to `App.tsx` editor controls bar (or `VideoPlayer.tsx` controls); reads `playbackStore.currentTime` and the clip whose range contains `currentTime`; calls `splitClip(id, currentTime)`; disabled when no clip contains `currentTime` or when `currentTime` is within 100ms of a clip boundary

**Patterns to follow:**
- `src/components/Timeline.tsx` — existing `isDraggingRef`, `scrubTimeRef`, `setPointerCapture` pattern
- Full four-handler set per `docs/solutions/ui-bugs/video-player-layout-invisible-elements-2026-03-29.md`

**Technical design:** *(directional — not implementation specification)*

```
pointerdown:
  for each clip in clips:
    inX = timeToPixel(clip.startTime, ...)
    outX = timeToPixel(clip.endTime, ...)
    if |offsetX - inX| <= 8: capture, activeDrag = {type:'in', clipId}; return
    if |offsetX - outX| <= 8: capture, activeDrag = {type:'out', clipId}; return
  // no handle hit — fall through to scrub logic

pointermove:
  if activeDrag:
    t = clamp(pixelToTime(offsetX, ...), 0, duration)
    if activeDrag.type === 'in': inPointDragRef = {clipId, time: t}
    else: outPointDragRef = {clipId, time: t}
    return  // do not update scrubTimeRef
  // else: existing scrub path

pointerup / pointercancel:
  if activeDrag:
    commit dragRef value to store (setTrimIn or setTrimOut)
    clear dragRef and activeDrag
    release pointer capture
    return
  // else: existing scrub commit path
```

**Test scenarios:**
- Happy path: pointerdown at x=40 (in-point of clip `[2,8]` on 200px/10s canvas) → `activeDragRef` set to `{type:'in', clipId}`; `setPointerCapture` called
- Happy path: pointermove to x=60 while dragging in-point → `inPointDragRef` updated to `{clipId, time: 3}`; `setCurrentTime` not called
- Happy path: pointerup after dragging in-point to x=60 → `setTrimIn(clipId, 3)` called; `inPointDragRef` cleared
- Happy path: pointerdown at x=200 (neutral area, no handle within 8px) → existing scrub logic fires, `activeDragRef` is null
- Edge case: pointercancel during in-point drag → `setTrimIn` called with last ref value; `inPointDragRef` cleared; drag state reset
- Edge case: pointerdown at x=40 when in-point is at x=40 and out-point is also at x=40 (zero-length clip edge case) → in-point wins (first checked)
- Edge case: dragging in-point past out-point → `pixelToTime` result is passed to `setTrimIn` which enforces the 100ms minimum (clamp happens in store, not in drag handler)
- Integration: after pointerup commits trim, the next RAF frame renders the handle at the committed position (not the drag position)
- Happy path: split button clicked with playhead at 5s on a `[0, 10]` clip → `splitClip(clipId, 5)` called
- Edge case: split button clicked with playhead at 0.05s (within 100ms of clip start) → button is disabled; `splitClip` not called

**Verification:**
- Dragging a trim handle updates the canvas render in real time without any Zustand writes during the drag
- Releasing the handle commits the final value to the store exactly once
- Playhead scrub behavior is unchanged when pointer-down is not near a handle
- Split button correctly enables/disables based on playhead position relative to clip boundaries
- `npm run typecheck` and `npm run lint` pass

---

- [ ] **Unit 5: Crop store**

**Goal:** Create `cropStore` with crop region state, aspect ratio preset, and overlay toggle; wire it into `App.tsx`.

**Requirements:** R6, R7, R8

**Dependencies:** Unit 2 (types `CropRegion` and `AspectRatioPreset` are already added there)

**Files:**
- Create: `src/stores/cropStore.ts`
- Test: `src/stores/__tests__/cropStore.test.ts`

**Approach:**
- State: `cropRegion: CropRegion | null` (null = no crop set), `aspectRatio: AspectRatioPreset` (default `'free'`), `isCropOverlayOpen: boolean`
- Actions: `setCropRegion(region: CropRegion)`, `setAspectRatio(preset: AspectRatioPreset)`, `clearCrop()` (sets region to null, ratio to 'free'), `toggleCropOverlay()`, `reset()`
- `setAspectRatio` also updates `cropRegion` to enforce the new aspect ratio centered on the current region: compute new height from current width × ratio; if exceeds bounds, reduce width first; if `cropRegion` is null, set a default centered region (e.g., 80% of frame)
- Aspect ratio constants: `16:9` → `16/9`, `9:16` → `9/16`, `1:1` → `1`
- Store follows the same flat-state, `State & Actions` pattern as `playbackStore`

**Patterns to follow:**
- `src/stores/playbackStore.ts` — full store template

**Test scenarios:**
- Happy path: `setCropRegion({x:0.1, y:0.1, width:0.8, height:0.8})` → `cropRegion` is set to those values
- Happy path: `setAspectRatio('16:9')` with `cropRegion: {x:0.1, y:0.1, width:0.8, height:0.8}` → new height is `0.8 / (16/9) ≈ 0.45`; `cropRegion.width` unchanged at `0.8`
- Happy path: `setAspectRatio('9:16')` with same region → new height is `0.8 / (9/16) ≈ 1.42`; width is reduced to fit within `1 - x = 0.9`; height becomes `0.9 * (16/9) ≈ 1.6`… wait, need to compute correctly: `9:16` means width/height = 9/16, so height = width * (16/9). Let's verify: for `9:16` preset (portrait), width = 9 parts, height = 16 parts. So height = width * 16/9. If width = 0.8, height = 0.8 * 16/9 ≈ 1.42 which exceeds 1.0. So reduce height to max possible (1 - y = 0.9) and compute width = 0.9 * 9/16 = 0.506.
- Happy path: `clearCrop()` → `cropRegion` is null, `aspectRatio` is `'free'`
- Happy path: `toggleCropOverlay()` → `isCropOverlayOpen` flips from false to true
- Happy path: `setAspectRatio('16:9')` when `cropRegion` is null → sets a default centered region with correct aspect ratio
- Edge case: `setCropRegion({x:0, y:0, width:0, height:0})` — width and height of 0 are accepted by the store; validation is deferred to the drag handler
- Edge case: `reset()` → all state returns to initial values

**Verification:**
- All test scenarios pass
- `cropStore` is exported and importable from `src/stores/cropStore.ts`
- `npm run typecheck` and `npm run lint` pass

---

- [ ] **Unit 6: Crop overlay component**

**Goal:** Add a DOM overlay on top of the video preview that shows the current crop region as a draggable rectangle with corner resize handles and preset buttons.

**Requirements:** R6, R7, R8, R9

**Dependencies:** Unit 5

**Files:**
- Create: `src/components/CropOverlay.tsx`
- Create: `src/utils/cropGeometry.ts` (contains `getVideoDisplayRect` helper)
- Modify: `src/components/VideoPlayer.tsx` (add crop toggle button to controls; conditionally render `CropOverlay`)
- Test: `src/components/__tests__/CropOverlay.test.tsx`
- Test: `src/utils/__tests__/cropGeometry.test.ts`

**Approach:**
- `CropOverlay` is a `position: absolute` div that fills the video preview container (requires the container to be `position: relative`); this is CSS only, no layout restructuring
- Renders two layers: a darkened region outside the crop rectangle (using `box-shadow: inset` or SVG clip path — deferred to implementation) and four corner drag handles (small `position: absolute` divs at each corner of the crop rect)
- Crop rect position is computed from `cropRegion` (normalized) × displayed video frame dimensions. The displayed video frame must account for `object-fit: contain` letterboxing: extract a `getVideoDisplayRect(containerEl, videoWidth, videoHeight)` helper that returns `{left, top, width, height}` in container-relative CSS pixels. This helper should live in `src/utils/cropGeometry.ts` and be tested independently (see test scenarios below).
- Corner drag: `pointerdown` on corner handle → `cropDragRef = {corner, startRegion, startX, startY}`; `pointermove` → compute new region maintaining aspect ratio if `aspectRatio !== 'free'`; `pointerup`/`pointercancel` → `setCropRegion(cropDragRef.current.region)`
- Preset buttons: three buttons ("16:9", "9:16", "1:1") call `setAspectRatio` with the matching preset; a "Free" button calls `setAspectRatio('free')`; active preset is highlighted
- Crop toggle button in `VideoPlayer.tsx` controls calls `toggleCropOverlay()`; only shown when `hasVideo` is true
- The overlay's `onPointerDown` on the crop region itself (not corners) allows moving the whole crop rect (optional stretch goal; deferred if time-constrained)

**Patterns to follow:**
- `src/components/Timeline.tsx` — four-handler drag pattern, `setPointerCapture`, ref-based ephemeral drag state
- `src/stores/cropStore.ts` (Unit 5) — reads `cropRegion`, `aspectRatio`, `isCropOverlayOpen`
- `src/stores/playbackStore.ts` — reads `videoWidth`, `videoHeight`, `hasVideo`

**Test scenarios (cropGeometry utility):**
- Happy path: `getVideoDisplayRect` with container `{width: 800, height: 450}`, video `1920×1080` (16:9 both) → displayed rect fills full container: `{left: 0, top: 0, width: 800, height: 450}`
- Happy path: `getVideoDisplayRect` with container `{width: 800, height: 600}`, video `1920×1080` (16:9 video in 4:3 container) → letterboxed: `{left: 0, top: 75, width: 800, height: 450}` (75px top/bottom pillarbox)
- Happy path: `getVideoDisplayRect` with container `{width: 600, height: 800}`, video `1080×1920` (9:16 portrait video) → fills height: `{left: 150, top: 0, width: 300, height: 800}` (150px left/right pillarbox)
- Edge case: `videoWidth: 0` or `videoHeight: 0` → returns `{left: 0, top: 0, width: 0, height: 0}` (no divide-by-zero)

**Test scenarios (CropOverlay component):**
- Happy path: renders with `isCropOverlayOpen: true` and `cropRegion: {x:0.1, y:0.1, width:0.8, height:0.45}` → crop rectangle element is present in the DOM
- Happy path: `isCropOverlayOpen: false` → overlay is not rendered
- Happy path: `hasVideo: false` → crop toggle button is not rendered in `VideoPlayer`
- Happy path: clicking "16:9" preset button → `setAspectRatio('16:9')` is called on the store
- Happy path: clicking "Free" preset button → `setAspectRatio('free')` is called
- Happy path: pointerdown on top-left corner handle → `setPointerCapture` is called; pointermove updates position; pointerup → `setCropRegion` called once with final normalized coordinates
- Edge case: pointercancel during corner drag → `setCropRegion` called with last drag ref value; drag state reset
- Edge case: `cropRegion` is null → overlay renders without a crop rectangle (shows full-frame state or placeholder); no crash
- Edge case: `videoWidth: 0` (video not yet loaded dimensions) → overlay does not render crop rect; no crash

**Verification:**
- Crop overlay appears over video when toggled on and video is loaded
- Dragging a corner handle updates `cropRegion` in the store on pointer release
- Preset buttons visually indicate the active preset
- No Zustand writes occur during the drag (only on pointer release)
- `npm run typecheck` and `npm run lint` pass

## System-Wide Impact

- **Interaction graph:** `App.tsx` gains a new call to `clipsStore.initDefaultClip` in the `loadedmetadata` handler. `VideoPlayer.tsx` gains a crop toggle button and conditionally renders `CropOverlay`. `useTimelineRenderer` gains new arguments (drag refs from `Timeline.tsx`) — callers must be updated. The timeline canvas `pointerdown` handler now has priority logic that may consume pointer events before the existing scrub path; the scrub path is only reached when no handle is hit.

- **Error propagation:** All drag errors are silent (wrong coordinates are bounded by clamps in `pixelToTime` and store actions). A `splitClip` call with an invalid `atTime` is a no-op — no error is thrown or surfaced to the user. The crop overlay's letter/pillarbox math may produce incorrect coordinates if `videoWidth`/`videoHeight` are zero; guarded by not rendering the crop rect when dimensions are unavailable.

- **State lifecycle risks:** If a user loads a second video without the app being reset, `initDefaultClip` replaces all clips — this correctly clears any splits from the previous video. `cropStore` is not automatically reset on new video load; the implementer should decide in Unit 2 whether to add a `reset()` call alongside `initDefaultClip`. This is flagged as a deferred implementation note.

- **API surface parity:** The split button in `App.tsx` reads `playbackStore.currentTime` — if Phase 5 later changes how current time is expressed (e.g., frame numbers), the split button must be updated. No other external API surfaces.

- **Integration coverage:** Unit tests alone cannot prove that `initDefaultClip` is correctly called after `loadedmetadata` fires and before the user attempts to trim. An integration test in `src/App.test.tsx` should verify: load a video → default clip appears in `clipsStore` with correct duration.

- **Unchanged invariants:** `videoRef` is still always passed as a prop; it does not move into stores or context. The existing playhead scrub behavior in `Timeline.tsx` is preserved and reached when pointer-down is not near any handle. `playbackStore` structure is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Trim handle hit area (8px) is too small on touch devices | 8px is a planning estimate; implementer should test on touch and can increase to 12–16px if needed |
| Letterbox/pillarbox math for crop overlay is non-trivial | Deferred to implementation; a helper function `getVideoDisplayRect(videoEl)` should be extracted and tested independently |
| Two handles overlapping at the same x (e.g., after a split) makes one un-clickable | Priority rule (in-point checked before out-point) resolves ties; deferred UX improvement: offset overlapping handles by a few px visually |
| `cropRegion` with aspect ratio constraint can produce edge-case rounding issues at video boundaries | Normalize and clamp all `CropRegion` values to `[0, 1]` after every mutation in the store |
| `useTimelineRenderer` signature change (new drag ref args) breaks the existing hook call in Timeline | Unit 3 and Unit 4 must be implemented together or in strict order; the plan sequences them that way |

## Sources & References

- Related code: `src/components/Timeline.tsx`, `src/hooks/useTimelineRenderer.ts`, `src/stores/clipsStore.ts`, `src/stores/playbackStore.ts`, `src/types/editor.ts`
- Prior plan: `docs/plans/2026-03-28-001-feat-phase1-playback-canvas-timeline-plan.md`
- Institutional solution: `docs/solutions/ui-bugs/video-player-layout-invisible-elements-2026-03-29.md`
