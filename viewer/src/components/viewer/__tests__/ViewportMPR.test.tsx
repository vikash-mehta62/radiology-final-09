import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import '../../../test/cornerstone-setup'
import ViewportMPR from '../ViewportMPR'

// Mock the cornerstone utilities
vi.mock('@/lib/cornerstone/utils', () => ({
  getRenderingEngineInstance: vi.fn().mockReturnValue({
    id: 'test-engine',
    setViewports: vi.fn(),
    disableElement: vi.fn(),
    getViewport: vi.fn().mockReturnValue({
      setVolumes: vi.fn().mockResolvedValue(undefined),
      setOrientation: vi.fn(),
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
    type: 'orthographic',
    element: document.createElement('div'),
  }),
  setVolumeViewportData: vi.fn().mockResolvedValue(undefined),
  loadVolume: vi.fn().mockResolvedValue({
    volumeId: 'test-volume',
    metadata: {
      WindowCenter: 40,
      WindowWidth: 400,
    },
  }),
  addTools: vi.fn(),
}))

describe('ViewportMPR', () => {
  const mockProps = {
    baseViewportId: 'test-mpr',
    volumeId: 'test-volume-id',
    imageIds: [
      'wadouri:/api/dicom/studies/1.2.3/series/1.2.4/instances/1.2.5',
      'wadouri:/api/dicom/studies/1.2.3/series/1.2.4/instances/1.2.6',
      'wadouri:/api/dicom/studies/1.2.3/series/1.2.4/instances/1.2.7',
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state correctly', () => {
    render(<ViewportMPR {...mockProps} isLoading={true} />)
    
    expect(screen.getByText('Loading volume...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load volume data'
    render(<ViewportMPR {...mockProps} error={errorMessage} />)
    
    expect(screen.getByText('Failed to load volume')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders empty state when no image IDs provided', () => {
    render(<ViewportMPR {...mockProps} imageIds={[]} />)
    
    expect(screen.getByText('No volume data to display')).toBeInTheDocument()
  })

  it('renders all three MPR viewports with labels', async () => {
    render(<ViewportMPR {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Axial')).toBeInTheDocument()
      expect(screen.getByText('Sagittal')).toBeInTheDocument()
      expect(screen.getByText('Coronal')).toBeInTheDocument()
    })
  })

  it('creates viewport elements with correct IDs', async () => {
    render(<ViewportMPR {...mockProps} />)
    
    await waitFor(() => {
      const axialElement = document.getElementById(`${mockProps.baseViewportId}-axial`)
      const sagittalElement = document.getElementById(`${mockProps.baseViewportId}-sagittal`)
      const coronalElement = document.getElementById(`${mockProps.baseViewportId}-coronal`)
      
      expect(axialElement).toBeInTheDocument()
      expect(sagittalElement).toBeInTheDocument()
      expect(coronalElement).toBeInTheDocument()
    })
  })

  it('calls onViewportsReady callback when viewports are initialized', async () => {
    const onViewportsReady = vi.fn()
    
    render(<ViewportMPR {...mockProps} onViewportsReady={onViewportsReady} />)
    
    await waitFor(() => {
      expect(onViewportsReady).toHaveBeenCalledTimes(1)
      expect(onViewportsReady).toHaveBeenCalledWith({
        axial: expect.any(Object),
        sagittal: expect.any(Object),
        coronal: expect.any(Object),
      })
    })
  })

  it('applies custom width and height styles', () => {
    render(<ViewportMPR {...mockProps} width={800} height={600} />)
    
    const container = screen.getByRole('generic')
    expect(container).toHaveStyle({
      width: '800px',
      height: '600px',
    })
  })

  it('handles viewport cleanup on unmount', () => {
    const { unmount } = render(<ViewportMPR {...mockProps} />)
    
    // Should not throw any errors during cleanup
    expect(() => unmount()).not.toThrow()
  })

  it('uses correct grid layout for MPR viewports', () => {
    render(<ViewportMPR {...mockProps} />)
    
    // Check that we have the expected grid structure
    const gridItems = screen.getAllByRole('generic').filter(el => 
      el.className.includes('MuiGrid-item')
    )
    
    // Should have 3 grid items (axial, sagittal, coronal)
    expect(gridItems).toHaveLength(3)
  })

  it('handles re-initialization when imageIds change', async () => {
    const { rerender } = render(<ViewportMPR {...mockProps} />)
    
    await waitFor(() => {
      const axialElement = document.getElementById(`${mockProps.baseViewportId}-axial`)
      expect(axialElement).toBeInTheDocument()
    })
    
    // Change the image IDs
    const newImageIds = [
      'wadouri:/api/dicom/studies/1.2.7/series/1.2.8/instances/1.2.9',
    ]
    
    rerender(<ViewportMPR {...mockProps} imageIds={newImageIds} />)
    
    // Should handle the change without errors
    expect(() => {
      rerender(<ViewportMPR {...mockProps} imageIds={newImageIds} />)
    }).not.toThrow()
  })

  it('displays viewport labels with correct styling', () => {
    render(<ViewportMPR {...mockProps} />)
    
    const axialLabel = screen.getByText('Axial')
    const sagittalLabel = screen.getByText('Sagittal')
    const coronalLabel = screen.getByText('Coronal')
    
    // Check that labels have the expected styling classes
    expect(axialLabel).toHaveClass('MuiTypography-caption')
    expect(sagittalLabel).toHaveClass('MuiTypography-caption')
    expect(coronalLabel).toHaveClass('MuiTypography-caption')
  })
})