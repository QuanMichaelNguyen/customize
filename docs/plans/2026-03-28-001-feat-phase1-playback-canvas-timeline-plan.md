---
title: "feat: Phase 1 — Playback Engine and Canvas Timeline"
type: feat
status: completed
date: 2026-03-28
---

# feat: Phase 1 — Playback Engine and Canvas Timeline

## Overview

Bootstrap the browser-based video clip editor from a greenfield repo. Deliver the playback engine (HTML5 `<video>` with file loading, play/pause, seek) and a Canvas-drawn timeline (60fps playhead tracking, click-to-scrub). This is the foundation all future phases plug into.

## Problem Frame

There is no source code yet. Phase 1 establishes the project scaffold, the state architecture, and the two core interactive components — video player and timeline — that define the editor's skeleton. Getting the RAF loop, Zustand integration, and pointer interaction patterns right here prevents rework in every subsequent phase.

## Requirements Trace

- R1. User can load a local video file and see it in the player
- R2. User can play and pause the video
- R3. User can click the timeline to seek to any position
- R4. The timeline playhead tracks playback in real time at display refresh rate (target 60fps)
- R5. The project builds with `npm run dev`, passes `npm run typecheck` and `npm run lint`, and tests run with `npm test`
- R6. The architecture supports future phases: multi-track, text overlays, crop, export — without structural rework

## Scope Boundaries

- No trim handles, split, crop, or text overlays — those are Phase 2 and 3
- No ffmpeg.wasm installation — deferred to Phase 6
- No audio waveform visualization — Phase 4
- No keyboard shortcuts — Phase 5
- Export is out of scope
- Multi-track timeline layout is out of scope; single track only
- Clip segments (in/out points) Zustand store shape should be defined but not wired to UI yet

## Context & Research

### Relevant Code and Patterns

- No existing source files — greenfield project
- CLAUDE.md is the authoritative spec for architecture constraints

### Institutional Learnings

- No prior solutions documented yet

### External References

- Vite 6 scaffold: `npm create vite@latest . -- --template react-swc-ts`
- Zustand v5: curried `create<T>()((set) => ...)` mandatory; use `.getState()` in RAF loops
- Tailwind v4: `@tailwindcss/vite` Vite plugin; single `@import "tailwindcss"` in CSS; no `tailwind.config.js`
- Canvas DPR scaling: `ResizeObserver` sets `canvas.width/height` once; never in RAF loop; must reapply `ctx.scale(dpr, dpr)` after each resize since canvas state resets on dimension reassignment
- RAF cleanup: `cancelledRef` boolean guard required alongside `cancelAnimationFrame` to prevent re-scheduling after unmount
- `video.play()` returns a Promise — must catch `AbortError` (fires when play() is immediately followed by pause())
- HTML5 video event order: `loadstart → loadedmetadata → loadeddata → canplay`; never read `duration`, `videoWidth`, `videoHeight`, or set `currentTime` before `loadedmetadata`
- Scrub drag: pointer events + `setPointerCapture`; use `offsetX` (CSS px, not physical px) to compute time; divide by `canvas.clientWidth`, not `canvas.width`
- Playback time in RAF: read `videoRef.current.currentTime` directly each frame; do not write to Zustand on every frame

## Key Technical Decisions

- **Separate Zustand stores (playback and clips) over a single combined store:** Playback state (currentTime, isPlaying, duration) and clip state (segments, in/out points) have different read/write frequencies and different consumers. Separation keeps each store flat. The slices pattern is deferred to Phase 4 when cross-store actions are needed for multi-track coordination.

- **videoRef owned by App, passed as prop to both VideoPlayer and Timeline:** The timeline's RAF loop reads `videoRef.current.currentTime` directly for smooth 60fps playhead motion. The video element lives in VideoPlayer but the ref must be shared. App owns the ref and passes it as a prop — simpler than context, avoids storing DOM nodes in Zustand.

- **Zustand `currentTime` is committed state, not live playback state:** During playback, `video.currentTime` is the source of truth for the RAF loop. `usePlaybackStore.currentTime` is updated only on: seek-via-scrub (pointerup), file load, and play/pause transitions. This avoids 60 store writes per second during playback.

- **Canvas RAF loop reads `playbackStore.getState()` directly, not React selectors:** React hooks cannot be called in RAF closures. `.getState()` returns the current snapshot synchronously without triggering re-renders — the correct Zustand pattern for non-React contexts.

- **Vitest + React Testing Library for test infrastructure:** Vitest integrates natively with Vite (shares config, faster than Jest). React Testing Library for component behavior. `jsdom` as the test environment for DOM simulation.

- **`react-swc-ts` Vite template over `react-ts`:** SWC-based transforms are significantly faster. No functional difference for this project.

## Open Questions

### Resolved During Planning

- **How does the timeline know the video duration when no video is loaded?** Show an empty/disabled state. The timeline renders a zero-duration state when `duration === 0` in the store.
- **Should `isPlaying` in the store mirror the DOM video state or be the source of truth?** Mirror only. The `play` and `pause` DOM events update the store. The store does not drive DOM playback — only button clicks and keyboard shortcuts (Phase 5) drive the DOM.
- **DPR scaling: where does the ctx.scale happen?** In the ResizeObserver callback, after setting `canvas.width`/`canvas.height`. Canvas state (including transform) resets to default when dimensions are reassigned — the scale must be reapplied there every time.

### Deferred to Implementation

- **Exact Tailwind class set for the editor chrome:** Layout structure is planned (player above timeline), exact spacing/colors to be decided during implementation.
- **Whether to `revokeObjectURL` immediately after assigning to `video.src` or on unmount:** In practice, assigning to `src` is sufficient to keep the blob alive for playback; revocation should happen on component unmount or when a new file is loaded. Exact cleanup placement deferred.
- **Vitest config specifics:** `jsdom` environment config, how to mock `HTMLVideoElement.play()` (not implemented in jsdom) — resolved during Unit 1 implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────┐
│                       App.tsx                       │
│  owns: videoRef (shared between player + timeline)  │
└──────────────┬────────────────────┬─────────────────┘
               │ prop               │ prop
               ▼                    ▼
  ┌────────────────────┐   ┌──────────────────────────┐
  │   VideoPlayer.tsx  │   │      Timeline.tsx         │
  │                    │   │                           │
  │  <video ref={..}>  │   │  <canvas ref={..}>        │
  │  <input type=file> │   │  useTimelineRenderer(     │
  │                    │   │    canvasRef, videoRef)    │
  │  Events:           │   │                           │
  │  loadedmetadata ──►│──►│  Pointer events:          │
  │  play/pause ──────►│   │  pointerdown/move/up      │
  └────────────────────┘   │  + setPointerCapture      │
           │               └────────────┬──────────────┘
           │ read/write                 │ read/write
           ▼                            ▼
  ┌────────────────────────────────────────────────────┐
  │             usePlaybackStore (Zustand)              │
  │  currentTime, duration, isPlaying                  │
  │  videoWidth, videoHeight, hasVideo                  │
  └────────────────────────────────────────────────────┘
           ▲
           │ .getState() inside RAF loop (no re-render)
  ┌────────────────────────────────────────────────────┐
  │          useTimelineRenderer (RAF loop)            │
  │                                                    │
  │  each frame:                                       │
  │    time = isDragging                               │
  │      ? scrubTimeRef.current                        │
  │      : videoRef.current?.currentTime ?? 0          │
  │    playheadX = (time / duration) * cssWidth        │
  │    ctx.clearRect + draw timeline + draw playhead   │
  └────────────────────────────────────────────────────┘
```

Data flow summary:
- **Write path (file load):** FileInput → `URL.createObjectURL` → `video.src` → `loadedmetadata` → store.setDuration/setDimensions/setHasVideo
- **Write path (play/pause):** Button click → `video.play()/pause()` → DOM `play`/`pause` events → store.setPlaying
- **Write path (scrub):** pointerdown → scrubTimeRef (ref only) → pointerup → `video.currentTime = time` + store.setCurrentTime
- **Read path (RAF):** RAF loop → `videoRef.current.currentTime` OR `scrubTimeRef.current` → draw playhead

## Implementation Units

- [x] **Unit 1: Project Bootstrap**

**Goal:** Scaffold the Vite project, install all Phase 1 dependencies, configure TypeScript strictly, set up Tailwind v4, configure Vitest, and create the directory structure and empty shell files.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `package.json` (via scaffold)
- Create: `vite.config.ts`
- Create: `tsconfig.app.json`
- Create: `src/index.css`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (shell — wired in Unit 6)
- Create: `src/types/editor.ts`
- Create: `src/stores/` (directory)
- Create: `src/components/` (directory)
- Create: `src/hooks/` (directory)
- Create: `vitest.config.ts` or vitest config inside `vite.config.ts`

**Approach:**
- Scaffold with `npm create vite@latest . -- --template react-swc-ts`
- Install: `zustand`, `tailwindcss`, `@tailwindcss/vite`
- Install dev: `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- Add `tailwindcss()` to `plugins` array in `vite.config.ts` alongside the existing `react()` plugin
- Add `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] }` to Vite config
- Add `@import "tailwindcss";` to `src/index.css` (replaces all `@tailwind` directives)
- Set `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true` in `tsconfig.app.json`; set `"moduleResolution": "bundler"`
- `src/types/editor.ts` defines shared types: `VideoMetadata`, `PlaybackStatus` — used by store and components

**Patterns to follow:**
- Vite 6 `react-swc-ts` template conventions
- Tailwind v4 CSS-first config (no `tailwind.config.js`)

**Test scenarios:**
- Happy path: `npm run dev` starts without errors; `npm run typecheck` passes with zero errors; `npm test` runs (zero tests, zero failures)

**Verification:**
- `npm run dev` serves the Vite default page without errors
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm test` exits 0

---

- [x] **Unit 2: Playback Zustand Store**

**Goal:** Define the `usePlaybackStore` with all state fields and actions needed by VideoPlayer and Timeline for Phase 1. Also stub `useClipsStore` with the Phase 1-relevant shape (empty clips array, no UI yet) so the architecture supports Phase 2 without store restructuring.

**Requirements:** R2, R3, R4, R6

**Dependencies:** Unit 1

**Files:**
- Create: `src/stores/playbackStore.ts`
- Create: `src/stores/clipsStore.ts` (stub)
- Create: `src/stores/__tests__/playbackStore.test.ts`

**Approach:**
- `usePlaybackStore` fields: `currentTime: number`, `duration: number`, `isPlaying: boolean`, `videoWidth: number`, `videoHeight: number`, `hasVideo: boolean`
- Actions: `setCurrentTime`, `setDuration`, `setPlaying`, `setVideoMetadata` (sets width/height/hasVideo/duration together — avoids partial-update bugs on file load), `reset`
- `useClipsStore` fields: `clips: ClipSegment[]` (empty array), `addClip`, `removeClip` — stub only, not used in Phase 1
- Use Zustand v5 curried form: `create<StoreType>()((set) => ({ ... }))`
- Stores are exported as named hooks; `.getState()` is available as a static method on the returned hook

**Patterns to follow:**
- Zustand v5 TypeScript pattern: `create<T>()((set) => ...)`
- Flat store shape — no nested objects

**Test scenarios:**
- Happy path: `setCurrentTime(30)` → `getState().currentTime === 30`
- Happy path: `setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })` → all four fields updated atomically, `hasVideo === true`
- Happy path: `setPlaying(true)` → `getState().isPlaying === true`
- Happy path: `reset()` → all fields return to initial values
- Edge case: `setCurrentTime(-1)` — implementation should clamp to 0 or document behavior; test the chosen behavior
- Edge case: `setCurrentTime` called with value greater than `duration` — clamp to `duration` or document; test the chosen behavior

**Verification:**
- All store actions produce the expected state transitions
- TypeScript compiler accepts store usage without `any` casts

---

- [x] **Unit 3: VideoPlayer Component**

**Goal:** Render the `<video>` element and file input. Handle file loading, play/pause control, and metadata extraction. Keep the component thin — business logic lives in the store and the video element's own DOM events.

**Requirements:** R1, R2

**Dependencies:** Unit 2

**Files:**
- Create: `src/components/VideoPlayer.tsx`
- Create: `src/components/__tests__/VideoPlayer.test.tsx`

**Approach:**
- Props: `videoRef: React.RefObject<HTMLVideoElement>`
- File input: `<input type="file" accept="video/*">` — on change, call `URL.createObjectURL(file)`, assign to `videoRef.current.src`; store the blob URL in a local ref for cleanup
- On `loadedmetadata`: read `video.duration`, `video.videoWidth`, `video.videoHeight`; dispatch `playbackStore.setVideoMetadata(...)`
- Play/pause button: calls `video.play()` (catch `AbortError`) or `video.pause()`; does NOT call `store.setPlaying` directly — instead, listen to the DOM `play` and `pause` events on the video element and sync store from those
- Cleanup on unmount: `URL.revokeObjectURL(blobUrlRef.current)`
- The `<video>` element should be `hidden` when `!hasVideo` so the layout doesn't shift before a file is loaded

**Patterns to follow:**
- `useRef` for videoRef (owned by App, passed as prop)
- `useEffect` for event listeners with cleanup returns

**Test scenarios:**
- Happy path: component renders a file input and a video element
- Happy path: selecting a file assigns a blob URL to `video.src` and updates the store via `loadedmetadata` — mock `loadedmetadata` dispatch in test
- Happy path: clicking Play calls `video.play()` (mock the promise); clicking Pause calls `video.pause()`
- Error path: `video.play()` rejects with `AbortError` — no unhandled rejection surfaces to console
- Error path: `video.play()` rejects with a non-`AbortError` — error is re-thrown or logged
- Integration: `loadedmetadata` event → `playbackStore.setVideoMetadata` called with correct values
- Edge case: `loadedmetadata` fires before component unmounts — no state update on unmounted component

**Verification:**
- File input → video loads → play/pause button state matches `store.isPlaying`
- No blob URL leak: `URL.revokeObjectURL` called on unmount in test

---

- [x] **Unit 4: Canvas Timeline Renderer Hook**

**Goal:** Encapsulate the RAF loop and all canvas drawing in a reusable hook. Reads playback state from the store and video element directly — no React state involved. Handles DPR scaling and resize via `ResizeObserver`.

**Requirements:** R4

**Dependencies:** Unit 2

**Files:**
- Create: `src/hooks/useTimelineRenderer.ts`
- Create: `src/hooks/__tests__/useTimelineRenderer.test.ts`

**Approach:**
- Signature: `useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef)`
- DPR setup: `ResizeObserver` on the canvas element sets `canvas.width = Math.round(cssWidth * dpr)`, `canvas.height = Math.round(cssHeight * dpr)`, `canvas.style.width/height`, then calls `ctx.scale(dpr, dpr)` — must reapply scale after every resize since canvas state resets on dimension reassignment
- RAF loop: `cancelledRef` boolean + `cancelAnimationFrame(rafHandle)` for cleanup
- Each frame: compute `currentTime` — if `isDraggingRef.current`, read `scrubTimeRef.current`; else read `videoRef.current?.currentTime ?? usePlaybackStore.getState().currentTime`
- Each frame: compute `duration` from `usePlaybackStore.getState().duration`; compute `playheadX = (currentTime / Math.max(duration, 0.001)) * cssWidth`
- Draw calls (per frame): clear canvas; draw timeline background track (full width, horizontal bar); draw playhead (vertical line at `playheadX`)
- Drawing reads CSS dimensions (`canvas.clientWidth`) for coordinate math — not physical pixel dimensions

**Patterns to follow:**
- RAF + `cancelledRef` guard pattern (from research: prevents re-schedule after cleanup)
- `ResizeObserver` for DPR scaling (not in draw loop)
- `usePlaybackStore.getState()` for store reads (not selectors)

**Test scenarios:**
- Happy path: hook starts RAF loop on mount; `cancelAnimationFrame` is called on unmount
- Happy path: `cancelledRef` is set to true before `cancelAnimationFrame` on cleanup — RAF does not reschedule after unmount
- Edge case: `duration === 0` — playhead renders at position 0 without division by zero error
- Edge case: canvas resize triggers `ResizeObserver` → `ctx.scale` reapplied → subsequent draw calls use correct DPR-scaled coordinates
- Integration: when `isDraggingRef.current === true`, loop reads `scrubTimeRef.current` rather than `video.currentTime`

**Verification:**
- No RAF handles leak after unmount (test by asserting `cancelAnimationFrame` was called)
- No console errors on zero-duration state
- TypeScript: hook signature is fully typed with no `any`

---

- [x] **Unit 5: Timeline Canvas Component with Scrub Interaction**

**Goal:** Render the `<canvas>` element and wire pointer events for click-to-scrub. All drag state is ephemeral (refs). Commits the final time to the store and video element on `pointerup` only.

**Requirements:** R3, R4

**Dependencies:** Unit 4

**Files:**
- Create: `src/components/Timeline.tsx`
- Create: `src/components/__tests__/Timeline.test.tsx`

**Approach:**
- Props: `videoRef: React.RefObject<HTMLVideoElement>`
- Local refs: `canvasRef`, `isDraggingRef`, `scrubTimeRef`
- Passes all four refs to `useTimelineRenderer`
- `onPointerDown`: call `e.currentTarget.setPointerCapture(e.pointerId)`; set `isDraggingRef.current = true`; compute time from `e.nativeEvent.offsetX` and `canvas.clientWidth` + `store.duration`; write to `scrubTimeRef.current`
- `onPointerMove`: if `!isDraggingRef.current` return; compute and write `scrubTimeRef.current` only
- `onPointerUp`: set `isDraggingRef.current = false`; write `scrubTimeRef.current` to `videoRef.current.currentTime` and `usePlaybackStore.getState().setCurrentTime(scrubTimeRef.current)`
- Time clamping: `Math.max(0, Math.min(computedTime, duration))` before writing to ref
- `offsetX` is in CSS pixels (pre-DPR); divide by `canvas.clientWidth` (CSS width), not `canvas.width`

**Patterns to follow:**
- `setPointerCapture` for capture-based drag (not global event listeners)
- Ref-only ephemeral state — no `useState` for drag values

**Test scenarios:**
- Happy path: pointerdown on canvas → `isDraggingRef.current` becomes true; scrubTimeRef updated to correct time proportion
- Happy path: pointermove after pointerdown → `scrubTimeRef.current` updates; store NOT updated yet
- Happy path: pointerup after drag → `store.setCurrentTime` called with final scrubTimeRef value; `video.currentTime` assigned
- Edge case: pointerdown at x=0 → time = 0
- Edge case: pointerdown at x=canvas.clientWidth → time = duration (not overflow)
- Edge case: pointerdown when `duration === 0` → no division by zero; time stays at 0
- Edge case: pointermove without prior pointerdown (no capture) → `isDraggingRef.current === false`, no scrub update

**Verification:**
- Clicking any x position on the canvas updates `video.currentTime` to the proportional time value on pointerup
- No Zustand writes occur during pointermove (only refs touched)

---

- [x] **Unit 6: App Assembly and Editor Layout**

**Goal:** Wire VideoPlayer and Timeline together in App. Share `videoRef`. Apply Tailwind layout for the editor chrome: video preview above, timeline below.

**Requirements:** R1–R5

**Dependencies:** Units 3, 5

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

**Approach:**
- `App` creates `videoRef = useRef<HTMLVideoElement>(null)` and passes to both `<VideoPlayer videoRef={videoRef}>` and `<Timeline videoRef={videoRef}>`
- Layout: full-height dark container; VideoPlayer fills the upper area; Timeline is a fixed-height strip at the bottom (e.g., 80px)
- When `hasVideo === false` (from store), show a centered "Load a video to get started" placeholder in the player area; the timeline renders in its empty state
- Tailwind classes handle all layout — no inline styles

**Patterns to follow:**
- Thin App component — no logic, only wiring and layout

**Test scenarios:**
- Happy path: App mounts without errors; VideoPlayer and Timeline are both in the DOM
- Integration: videoRef created in App is the same ref received by VideoPlayer and Timeline (structural test)

**Verification:**
- `npm run dev` renders the editor with a file input, dark chrome, and an empty timeline canvas
- `npm run typecheck` passes with zero errors
- `npm run lint` passes
- `npm test` runs all unit tests with zero failures

## System-Wide Impact

- **Interaction graph:** `<video>` DOM events (`loadedmetadata`, `play`, `pause`) are the write path into the store. The RAF loop is the read path out. These two paths do not cross — no circular updates.
- **Error propagation:** `video.play()` Promise rejection must be caught in VideoPlayer; no other async error surfaces in Phase 1. `URL.createObjectURL` cannot fail for a valid File object.
- **State lifecycle risks:** Blob URL leak if `revokeObjectURL` is not called on unmount or file replacement. `currentTime` clamping must be consistent between store and video element to avoid drift.
- **API surface parity:** `videoRef` is passed as a prop — not stored in context or Zustand — to keep DOM refs out of serializable state. This pattern must hold in future phases; components that need the video element receive the ref as a prop.
- **Integration coverage:** The RAF loop, pointer events, and store writes are three separate paths that converge on the playhead position. Unit tests cover each path in isolation; a manual integration test (load video, scrub, verify playhead moves) validates the convergence.
- **Unchanged invariants:** No existing APIs to preserve — greenfield.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `jsdom` does not implement `HTMLVideoElement.play()` or RAF | Mock `play()` in test setup; mock `requestAnimationFrame` in hook tests |
| Canvas drawing not testable in jsdom | Test hook behavior (RAF starts/stops, ref mutations) not pixel output; canvas drawing is verified visually |
| DPR scaling breaks on certain zoom levels (fractional devicePixelRatio) | Use `Math.round()` on canvas dimensions; ResizeObserver pattern handles this cleanly |
| `video.currentTime` not settable in jsdom | Mock the video element or use a test double in scrub tests |
| Zustand v5 curried syntax unfamiliar → `create<T>(set => ...)` (v4) used by mistake | Reviewed in Unit 2; test will fail to compile if wrong form used |
| ffmpeg.wasm requires `COOP`/`COEP` headers that may affect dev server | Not installed in Phase 1; add Vite headers plugin only in Phase 6 |

## Sources & References

- CLAUDE.md — project architecture constraints (canonical)
- Vite 6 docs: `react-swc-ts` template, `vite.config.ts` plugin setup
- Zustand v5 docs: curried `create<T>()()`, `.getState()` outside React
- Tailwind CSS v4 docs: `@tailwindcss/vite`, CSS-first config, `@import "tailwindcss"`
- MDN: `HTMLMediaElement.loadedmetadata`, `HTMLVideoElement.requestVideoFrameCallback`, Pointer Events API
- web.dev: `requestVideoFrameCallback` — frame-accurate video operations
- CSS-Tricks: requestAnimationFrame with React Hooks (RAF + cancelledRef pattern)
