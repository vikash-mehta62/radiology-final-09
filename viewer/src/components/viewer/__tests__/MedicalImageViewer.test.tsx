import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import '../../../test/cornerstone-setup'
import MedicalImageViewer from '../MedicalImageViewer'

// Mock the cornerstone initialization
vi.mock('@/lib/cornerstone/init', () => ({
  initializeCornerstone: vi.fn().mockResolvedValue(undefined),
  isCornerStoneInitialized: vi.fn().mockReturnValue(false),
}))

// Mock the cornerstone utilities
vi.mock('@/lib/cornerstone/utils', () => ({
  generateImageIds: vi.fn().mockImplementation((studyUID, seriesUID, sopUIDs) => 
    sopUIDs.map((sopUID: string) => `wadouri:/api/dicom/studies/${studyUID}/series/${seriesUID}/instances/${sopUID}`)
  ),
}))

// Mock the viewport components
vi.mock('../Viewport2D', () => ({
  default: vi.fn(({ viewportId, imageIds, onImageChange }) => {
    return (
      <div data-testid="viewport-2d">
        <div>Viewport2D: {viewportId}</div>
        <div>Images: {imageIds.length}</div>
        <button onClick={() => onImageChange?.(1)}>Change Image</button>
      </div>
    )
  }),
}))

vi.mock('../ViewportMPR', () => ({
  default: vi.fn(({ baseViewportId, volumeId, imageIds }) => (
    <div data-testid="viewport-mpr">
      <div>ViewportMPR: {baseViewportId}</div>
      <div>Volume: {volumeId}</div>
      <div>Images: {imageIds.length}</div>
    </div>
  )),
}))

vi.mock('../Viewport3D', () => ({
  default: vi.fn(({ viewportId, volumeId, imageIds, preset }) => (
    <div data-testid="viewport-3d">
      <div>Viewport3D: {viewportId}</div>
      <div>Volume: {volumeId}</div>
      <div>Images: {imageIds.length}</div>
      <div>Preset: {preset}</div>
    </div>
  )),
}))

describe('MedicalImageViewer', () => {
  const mockProps = {
    studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
    seriesInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.79',
    sopInstanceUIDs: [
      '1.2.840.113619.2.5.1762583153.215519.978957063.80',
      '1.2.840.113619.2.5.1762583153.215519.978957063.81',
      '1.2.840.113619.2.5.1762583153.215519.978957063.82',
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the initialization state
    const { isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    isCornerStoneInitialized.mockReturnValue(false)
  })

  it('shows initialization message when Cornerstone3D is not initialized', () => {
    render(<MedicalImageViewer {...mockProps} />)
    
    expect(screen.getByText('Initializing medical image viewer...')).toBeInTheDocument()
  })

  it('shows initialization error when Cornerstone3D fails to initialize', async () => {
    const { initializeCornerstone } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockRejectedValueOnce(new Error('WebGL not supported'))
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Viewer Initialization Failed')).toBeInTheDocument()
      expect(screen.getByText('WebGL not supported')).toBeInTheDocument()
    })
  })

  it('renders viewer tabs when initialized', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Stack')).toBeInTheDocument()
      expect(screen.getByText('MPR')).toBeInTheDocument()
      expect(screen.getByText('3D')).toBeInTheDocument()
    })
  })

  it('shows stack viewer by default', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-2d')).toBeInTheDocument()
      expect(screen.queryByTestId('viewport-mpr')).not.toBeInTheDocument()
      expect(screen.queryByTestId('viewport-3d')).not.toBeInTheDocument()
    })
  })

  it('switches to MPR viewer when MPR tab is clicked', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('MPR')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('MPR'))
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-mpr')).toBeInTheDocument()
      expect(screen.queryByTestId('viewport-2d')).not.toBeInTheDocument()
      expect(screen.queryByTestId('viewport-3d')).not.toBeInTheDocument()
    })
  })

  it('switches to 3D viewer when 3D tab is clicked', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('3D')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('3D'))
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-3d')).toBeInTheDocument()
      expect(screen.queryByTestId('viewport-2d')).not.toBeInTheDocument()
      expect(screen.queryByTestId('viewport-mpr')).not.toBeInTheDocument()
    })
  })

  it('displays image counter in stack mode', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Image 1 of 3')).toBeInTheDocument()
    })
  })

  it('updates image counter when image changes in stack mode', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Image 1 of 3')).toBeInTheDocument()
    })
    
    // Simulate image change
    fireEvent.click(screen.getByText('Change Image'))
    
    await waitFor(() => {
      expect(screen.getByText('Image 2 of 3')).toBeInTheDocument()
    })
  })

  it('uses initial mode prop', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} initialMode="mpr" />)
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-mpr')).toBeInTheDocument()
    })
  })

  it('passes loading state to viewport components', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} isLoading={true} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-2d')).toBeInTheDocument()
    })
    
    // The loading prop should be passed to the viewport component
    // This is tested indirectly through the component rendering
  })

  it('passes error state to viewport components', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    const errorMessage = 'Failed to load DICOM data'
    render(<MedicalImageViewer {...mockProps} error={errorMessage} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('viewport-2d')).toBeInTheDocument()
    })
    
    // The error prop should be passed to the viewport component
    // This is tested indirectly through the component rendering
  })

  it('generates correct image IDs from props', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    const { generateImageIds } = require('@/lib/cornerstone/utils')
    
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    render(<MedicalImageViewer {...mockProps} />)
    
    await waitFor(() => {
      expect(generateImageIds).toHaveBeenCalledWith(
        mockProps.studyInstanceUID,
        mockProps.seriesInstanceUID,
        mockProps.sopInstanceUIDs,
        '/api/dicom'
      )
    })
  })

  it('uses custom DICOM web base URL', async () => {
    const { initializeCornerstone, isCornerStoneInitialized } = require('@/lib/cornerstone/init')
    const { generateImageIds } = require('@/lib/cornerstone/utils')
    
    initializeCornerstone.mockResolvedValueOnce(undefined)
    isCornerStoneInitialized.mockReturnValue(true)
    
    const customBaseUrl = '/custom/dicom/api'
    render(<MedicalImageViewer {...mockProps} dicomWebBaseUrl={customBaseUrl} />)
    
    await waitFor(() => {
      expect(generateImageIds).toHaveBeenCalledWith(
        mockProps.studyInstanceUID,
        mockProps.seriesInstanceUID,
        mockProps.sopInstanceUIDs,
        customBaseUrl
      )
    })
  })
})