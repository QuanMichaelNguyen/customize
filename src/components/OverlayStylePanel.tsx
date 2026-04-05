import type { TextOverlay } from '../types/editor'
import { useOverlaysStore } from '../stores/overlaysStore'

const FONT_SIZES = [12, 16, 20, 24, 32, 48]

export default function OverlayStylePanel() {
  const overlays = useOverlaysStore((s) => s.overlays)
  const selectedOverlayId = useOverlaysStore((s) => s.selectedOverlayId)
  const overlay = overlays.find((o) => o.id === selectedOverlayId)

  if (!overlay) return null

  const update = (partial: Partial<Omit<TextOverlay, 'id'>>) => {
    useOverlaysStore.getState().updateOverlay(overlay.id, partial)
  }

  const handleDelete = () => {
    useOverlaysStore.getState().removeOverlay(overlay.id)
  }

  return (
    <div
      data-testid="overlay-style-panel"
      className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm text-white flex-wrap"
    >
      <label className="flex items-center gap-1.5">
        <span className="text-gray-400">Text</span>
        <input
          data-testid="overlay-content-input"
          type="text"
          value={overlay.content}
          onChange={(e) => update({ content: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-white w-36"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-400">Size</span>
        <select
          data-testid="overlay-fontsize-select"
          value={overlay.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-white"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-400">Color</span>
        <input
          data-testid="overlay-color-input"
          type="color"
          value={overlay.color}
          onChange={(e) => update({ color: e.target.value })}
          className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-400">BG</span>
        <input
          data-testid="overlay-bg-input"
          type="color"
          value={overlay.background === 'transparent' ? '#000000' : overlay.background}
          onChange={(e) => update({ background: e.target.value })}
          className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent"
        />
        <button
          data-testid="overlay-bg-transparent-btn"
          onClick={() => update({ background: 'transparent' })}
          className={`px-2 py-0.5 rounded text-xs ${
            overlay.background === 'transparent'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          None
        </button>
      </label>

      <button
        data-testid="overlay-delete-btn"
        onClick={handleDelete}
        className="ml-auto px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
      >
        Delete
      </button>
    </div>
  )
}
