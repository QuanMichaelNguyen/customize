import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExportPanel from '../ExportPanel'
import { useExportStore } from '../../stores/exportStore'
import { useSourceStore } from '../../stores/sourceStore'

function makeFile(size = 1024): File {
  return new File([new ArrayBuffer(size)], 'test.mp4', { type: 'video/mp4' })
}

// Stable mock refs so component and test share the same spy instances
const mockStartExport = vi.fn()
const mockCancelExport = vi.fn()

vi.mock('../../hooks/useFFmpegExport', () => ({
  useFFmpegExport: () => ({
    startExport: mockStartExport,
    cancelExport: mockCancelExport,
  }),
}))

beforeEach(() => {
  useExportStore.getState().resetExport()
  useSourceStore.getState().reset()
})

describe('ExportPanel', () => {
  describe('idle state', () => {
    it('renders Export button when a file is loaded', () => {
      useSourceStore.getState().setFile(makeFile())
      render(<ExportPanel />)
      expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
    })

    it('Export button is disabled when no file is loaded', () => {
      render(<ExportPanel />)
      const btn = screen.getByRole('button', { name: /export/i })
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })

    it('shows large file warning for files over 300 MB', () => {
      useSourceStore.getState().setFile(makeFile(301 * 1024 * 1024))
      render(<ExportPanel />)
      expect(screen.getByText(/large file/i)).toBeTruthy()
    })

    it('does not show large file warning for small files', () => {
      useSourceStore.getState().setFile(makeFile())
      render(<ExportPanel />)
      expect(screen.queryByText(/large file/i)).toBeNull()
    })
  })

  describe('loading state', () => {
    beforeEach(() => {
      useExportStore.getState().startExport()
    })

    it('renders a phase label during loading', () => {
      render(<ExportPanel />)
      // progress=0 → "Preparing…"
      expect(screen.getByText(/preparing/i)).toBeTruthy()
    })

    it('renders Cancel button during loading', () => {
      render(<ExportPanel />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
    })

    it('calls cancelExport when Cancel is clicked', () => {
      mockCancelExport.mockClear()
      render(<ExportPanel />)
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockCancelExport).toHaveBeenCalled()
    })

    it('shows Encoding label when progress is in mid range', () => {
      useExportStore.getState().setProgress(0.5)
      render(<ExportPanel />)
      expect(screen.getByText(/encoding/i)).toBeTruthy()
    })
  })

  describe('ready state', () => {
    beforeEach(() => {
      useExportStore.getState().setReady('blob:test-url')
    })

    it('renders a Download link with correct href', () => {
      render(<ExportPanel />)
      const link = screen.getByRole('link', { name: /download/i }) as HTMLAnchorElement
      expect(link.href).toContain('blob:test-url')
    })

    it('Download link has a download attribute', () => {
      render(<ExportPanel />)
      const link = screen.getByRole('link', { name: /download/i }) as HTMLAnchorElement
      expect(link.getAttribute('download')).toBeTruthy()
    })

    it('renders Export again button', () => {
      render(<ExportPanel />)
      expect(screen.getByRole('button', { name: /export again/i })).toBeTruthy()
    })

    it('Export again resets store to idle', () => {
      render(<ExportPanel />)
      fireEvent.click(screen.getByRole('button', { name: /export again/i }))
      expect(useExportStore.getState().status).toBe('idle')
    })
  })

  describe('error state', () => {
    beforeEach(() => {
      useExportStore.getState().setError('Something went wrong')
    })

    it('renders the error message', () => {
      render(<ExportPanel />)
      expect(screen.getByText(/something went wrong/i)).toBeTruthy()
    })

    it('renders Try again button', () => {
      render(<ExportPanel />)
      expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
    })

    it('Try again resets store to idle', () => {
      render(<ExportPanel />)
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(useExportStore.getState().status).toBe('idle')
    })
  })
})
