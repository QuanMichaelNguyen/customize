/*
Export panel: triggers export, shows phase-based progress, download link, and cancel.
Reads from exportStore and sourceStore; delegates to useFFmpegExport hook.
*/
import { useExportStore } from '../stores/exportStore'
import { useSourceStore } from '../stores/sourceStore'
import { useFFmpegExport } from '../hooks/useFFmpegExport'

const LARGE_FILE_BYTES = 300 * 1024 * 1024 // 300 MB warning threshold

function phaseLabel(progress: number): string {
  if (progress < 0.05) return 'Preparing…'
  if (progress < 0.95) return 'Encoding…'
  return 'Packaging…'
}

function outputFilename(): string {
  const now = new Date()
  const ts = now.toISOString().slice(0, 19).replace(/[T:]/g, '-')
  return `export-${ts}.mp4`
}

export default function ExportPanel() {
  const status = useExportStore((s) => s.status)
  const progress = useExportStore((s) => s.progress)
  const outputUrl = useExportStore((s) => s.outputUrl)
  const error = useExportStore((s) => s.error)
  const file = useSourceStore((s) => s.file)

  const { startExport, cancelExport } = useFFmpegExport()

  const isLargeFile = file !== null && file.size > LARGE_FILE_BYTES

  if (status === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => { void startExport(file) }}
          disabled={file === null}
          className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isLargeFile ? 'Large file — export may be slow or run out of memory' : 'Export video'}
        >
          Export
        </button>
        {isLargeFile && (
          <span className="text-xs text-amber-400" title="Files over 300 MB may run out of memory">
            Large file
          </span>
        )}
      </div>
    )
  }

  if (status === 'loading') {
    const phase = phaseLabel(progress)
    const isEncoding = progress >= 0.05 && progress < 0.95

    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1">{phase}</div>
          {isEncoding ? (
            <div className="w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : (
            <div className="w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="h-full bg-emerald-500 animate-pulse w-full" />
            </div>
          )}
        </div>
        <button
          onClick={cancelExport}
          className="px-2 py-1 text-xs text-gray-300 border border-gray-600 rounded hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === 'ready' && outputUrl) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={outputUrl}
          download={outputFilename()}
          className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          Download
        </a>
        <button
          onClick={() => useExportStore.getState().resetExport()}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white"
        >
          Export again
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 max-w-xs">
        <span className="text-xs text-red-400 truncate" title={error ?? ''}>
          {error ?? 'Export failed'}
        </span>
        <button
          onClick={() => useExportStore.getState().resetExport()}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white flex-shrink-0"
        >
          Try again
        </button>
      </div>
    )
  }

  return null
}
