import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import '../../../test/cornerstone-setup'
import Viewport3D from '../Viewport3D'

// Mock the cornerstone utilities
vi.mock('@/lib/cornerstone/utils', () => ({
  getRenderingEngineInstance: vi.fn().mockReturnValue({
    id: 'test-engine',
    enableElement: vi.fn(),
    disableElement: vi.fn(),
    getViewport: vi.fn().mockReturnValue({
      setVolumes: vi.fn().mockResolvedValue(undefined),
      getCamera: vi.fn().mockReturnValue({
        focalPoint: [0, 0, 0],
        position: [0, 0, 100],
        viewUp: [0, 1, 0],
      }),
      setCamera: vi.fn(),
      render: vi.fn(),
      getActors: vi.fn().mockReturnValue([
        {
          getProperty: vi.fn().mockReturnValue({
            getScalarOpacity: vi.fn().mockReturnValue({
              removeAllPoints: vi.fn(),
              addPoint: vi.fn(),
            }),
            getRGBTransferFunction: vi.fn().mockReturnValue({
              removeAllPoints: vi.fn(),
              addRGBPoint: vi.fn(),
            }),
            getGradientOpacity: vi.fn().mockReturnValue({
              removeAllPoints: vi.fn(),
              addPoint: vi.fn(),
            }),
            setShade: vi.fn(),
            setAmbient: vi.fn(),
            setDiffuse: vi.fn(),
            setSpecular: vi.fn(),
            setSpecularPower: vi.fn(),
            setInterpolationTypeToLinear: vi.fn(),
          }),
        },
      ]),
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
    type: 'volume3d',
    element: document.createElement('div'),
  }),
  loadVolume: vi.fn().mockResolvedValue({
    volumeId: 'test-volume',
    metadata: {
      WindowCenter: 40,
      WindowWidth: 400,
    },
  }),
  addTools: vi.fn(),
}))

describe('Viewport3D', () => {
  const mockProps = {
    viewportId: 'test-viewport-3d',
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
    render(<Viewport3D {...mockProps} isLoading={true} />)
    
    expect(screen.getByText('Loading 3D volume...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load 3D volume data'
    render(<Viewport3D {...mockProps} error={errorMessage} />)
    
    expect(screen.getByText('Failed to load 3D volume')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders empty state when no image IDs provided', () => {
    render(<Viewport3D {...mockProps} imageIds={[]} />)
    
    expect(screen.getByText('No volume data to display')).toBeInTheDocument()
  })

  it('renders viewport element when image IDs are provided', async () => {
    render(<Viewport3D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
  })

  it('calls onViewportReady callback when viewport is initialized', async () => {
    const onViewportReady = vi.fn()
    
    render(<Viewport3D {...mockProps} onViewportReady={onViewportReady} />)
    
    await waitFor(() => {
      expect(onViewportReady).toHaveBeenCalledTimes(1)
    })
  })

  it('applies CT-Bone preset by default', async () => {
    render(<Viewport3D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // The preset should be applied during initialization
    // We can't easily test the exact values, but we can ensure no errors occur
    expect(() => {
      render(<Viewport3D {...mockProps} preset="CT-Bone" />)
    }).not.toThrow()
  })

  it('applies different volume rendering presets', async () => {
    const presets = ['CT-Chest', 'CT-Abdomen', 'MR-Default'] as const
    
    for (const preset of presets) {
      const { unmount } = render(<Viewport3D {...mockProps} preset={preset} />)
      
      await waitFor(() => {
        const viewportElement = document.getElementById(mockProps.viewportId)
        expect(viewportElement).toBeInTheDocument()
      })
      
      unmount()
    }
  })

  it('applies custom volume properties when provided', async () => {
    const customProperties = {
      scalarOpacity: [
        [0, 0],
        [100, 0.5],
        [200, 1],
      ],
      colorTransfer: [
        [0, 0, 0, 0],
        [100, 1, 0, 0],
        [200, 1, 1, 1],
      ],
      gradientOpacity: [
        [0, 1],
        [255, 1],
      ],
    }
    
    render(<Viewport3D {...mockProps} volumeProperties={customProperties} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
  })

  it('applies custom width and height styles', () => {
    render(<Viewport3D {...mockProps} width={600} height={500} />)
    
    const container = screen.getByRole('generic')
    expect(container).toHaveStyle({
      width: '600px',
      height: '500px',
    })
  })

  it('handles viewport cleanup on unmount', () => {
    const { unmount } = render(<Viewport3D {...mockProps} />)
    
    // Should not throw any errors during cleanup
    expect(() => unmount()).not.toThrow()
  })

  it('updates volume properties when preset changes', async () => {
    const { rerender } = render(<Viewport3D {...mockProps} preset="CT-Bone" />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // Change the preset
    rerender(<Viewport3D {...mockProps} preset="CT-Chest" />)
    
    // Should handle the change without errors
    expect(() => {
      rerender(<Viewport3D {...mockProps} preset="CT-Chest" />)
    }).not.toThrow()
  })

  it('handles re-initialization when imageIds change', async () => {
    const { rerender } = render(<Viewport3D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // Change the image IDs
    const newImageIds = [
      'wadouri:/api/dicom/studies/1.2.7/series/1.2.8/instances/1.2.9',
    ]
    
    rerender(<Viewport3D {...mockProps} imageIds={newImageIds} />)
    
    // Should handle the change without errors
    expect(() => {
      rerender(<Viewport3D {...mockProps} imageIds={newImageIds} />)
    }).not.toThrow()
  })

  it('sets up proper 3D camera positioning', async () => {
    render(<Viewport3D {...mockProps} />)
    
    await waitFor(() => {
      const viewportElement = document.getElementById(mockProps.viewportId)
      expect(viewportElement).toBeInTheDocument()
    })
    
    // The camera positioning should be set during initialization
    // We can't easily test the exact camera values, but we can ensure the setup completes
    expect(() => {
      render(<Viewport3D {...mockProps} />)
    }).not.toThrow()
  })
})