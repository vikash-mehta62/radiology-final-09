import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import '../../../test/cornerstone-setup'
import Viewport2D from '../Viewport2D'

// Mock the cornerstone utilities
vi.mock('@/lib/cornerstone/utils', () => ({
  getRenderingEngineInstance: vi.fn().mockReturnValue({
    id: 'test-engine',
    enableElement: vi.fn(),
    disableElement: vi.fn(),
    getViewport: vi.fn().mockReturnValue({
      setStack: vi.fn().mockResolvedValue(undefined),
      getCurrentImageIdIndex: vi.fn().mockReturnValue(0),
      setImageIdIndex: vi.fn(),
      render: vi.fn(),
    }),
  }),
  createToolGroup: vi.fn().mockReturnValue({
    addTool: vi.fn(),
    setToolActive: vi.fn(),
    setToolMode: vi.fn(),
    addViewport: vi.fn(),
    removeViewports: vi.fn(),
    destroy: vi.fn(),
  }),
  createViewportSpec: vi.fn().mockReturnValue({
    viewportId: 'test-viewport',
    type: 'stack',
    element: document.createElement('div'),
  }),
  setStackViewportData: vi.fn().mockResolvedValue(undefined),
  addTools: vi.fn(),
}))

describe('Viewport2D', () => {
  const mockProps = {
    viewportId: 'test-viewport-2d',
    imageIds: [
      'wadouri:/api/dicom/studies/1.2.3/series/1.2.4/instances/1.2.5',
      'wadouri:/api/dicom/studies/1.2.3/series/1.2.4/instances/1.2.6',
    ],
    currentImageIndex: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state correctly', () => {
    render(<Viewport2D {...mockProps} isLoading={true} />)
    
    expect(screen.getByText('Loading images...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load DICOM images'
    render(<Viewport2D {...mockProps} error={errorMessage} />)
    
    expect(screen.getByText('Failed to load images')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders empty state when no image IDs provided', () => {
    render(<Viewport2D {...mockProps} imageIds={[]} />)
    
    expect(screen.getByText('No images to display')).toBeInTheDocument()
  })

  it('renders viewport element when image IDs are provided', async () => {
    render(<Viewport2D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
  })

  it('calls onViewportReady callback when viewport is initialized', async () => {
    const onViewportReady = vi.fn()
    
    render(<Viewport2D {...mockProps} onViewportReady={onViewportReady} />)
    
    await waitFor(() => {
      expect(onViewportReady).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onImageChange callback when image index changes', async () => {
    const onImageChange = vi.fn()
    
    const { rerender } = render(
      <Viewport2D {...mockProps} currentImageIndex={0} onImageChange={onImageChange} />
    )
    
    // Change the current image index
    rerender(
      <Viewport2D {...mockProps} currentImageIndex={1} onImageChange={onImageChange} />
    )
    
    await waitFor(() => {
      // The callback might be called during initialization and updates
      expect(onImageChange).toHaveBeenCalled()
    })
  })

  it('applies custom width and height styles', () => {
    render(<Viewport2D {...mockProps} width={500} height={400} />)
    
    const container = screen.getByRole('generic')
    expect(container).toHaveStyle({
      width: '500px',
      height: '400px',
    })
  })

  it('handles viewport cleanup on unmount', () => {
    const { unmount } = render(<Viewport2D {...mockProps} />)
    
    // Should not throw any errors during cleanup
    expect(() => unmount()).not.toThrow()
  })

  it('updates viewport when currentImageIndex prop changes', async () => {
    const { rerender } = render(
      <Viewport2D {...mockProps} currentImageIndex={0} />
    )
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // Change the current image index
    rerender(<Viewport2D {...mockProps} currentImageIndex={1} />)
    
    // Should not throw any errors when updating
    expect(() => {
      rerender(<Viewport2D {...mockProps} currentImageIndex={1} />)
    }).not.toThrow()
  })

  it('handles re-initialization when imageIds change', async () => {
    const { rerender } = render(<Viewport2D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // Change the image IDs
    const newImageIds = [
      'wadouri:/api/dicom/studies/1.2.7/series/1.2.8/instances/1.2.9',
    ]
    
    rerender(<Viewport2D {...mockProps} imageIds={newImageIds} />)
    
    // Should handle the change without errors
    expect(() => {
      rerender(<Viewport2D {...mockProps} imageIds={newImageIds} />)
    }).not.toThrow()
  })
})