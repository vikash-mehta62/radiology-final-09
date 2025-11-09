import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

import WorklistPage from '../WorklistPage'
import type { Study, WorklistResponse } from '@/types/worklist'
import type { PatientContext } from '@medical-imaging/shared-types'

// Mock services
const mockWorklistService = {
  getWorklist: vi.fn(),
  getStudyDetails: vi.fn(),
  updateStudyPriority: vi.fn(),
  assignStudy: vi.fn(),
}

const mockFhirService = {
  getPatientContext: vi.fn(),
}

vi.mock('@/services/worklistService', () => ({
  worklistService: mockWorklistService,
}))

vi.mock('@/services/fhirService', () => ({
  fhirService: mockFhirService,
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Test data
const mockStudies: Study[] = [
  {
    studyInstanceUID: '1.2.3.4.5',
    patientID: 'P001',
    patientName: 'John Doe',
    patientBirthDate: '1980-01-01',
    patientSex: 'M',
    studyDate: '2024-01-15',
    studyTime: '143000',
    studyDescription: 'CT Chest',
    modality: 'CT',
    accessionNumber: 'ACC001',
    numberOfSeries: 3,
    numberOfInstances: 150,
    priority: 'ROUTINE',
    status: 'SCHEDULED',
    aiStatus: 'COMPLETED',
    aiResults: [
      {
        id: 'ai-1',
        modelName: 'ChestCT-v1',
        modelVersion: '1.0.0',
        confidence: 0.85,
        findings: [
          {
            type: 'nodule',
            description: 'Small pulmonary nodule',
            confidence: 0.85,
            severity: 'LOW',
          },
        ],
        processingTime: 5000,
        createdAt: '2024-01-15T14:35:00Z',
      },
    ],
    assignedTo: 'Dr. Johnson',
    createdAt: '2024-01-15T14:00:00Z',
    updatedAt: '2024-01-15T14:35:00Z',
  },
  {
    studyInstanceUID: '1.2.3.4.6',
    patientID: 'P002',
    patientName: 'Jane Smith',
    studyDate: '2024-01-16',
    studyDescription: 'MR Brain',
    modality: 'MR',
    numberOfSeries: 5,
    numberOfInstances: 200,
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    aiStatus: 'PROCESSING',
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: '2024-01-16T09:15:00Z',
  },
]

const mockWorklistResponse: WorklistResponse = {
  studies: mockStudies,
  total: 2,
  page: 1,
  pageSize: 20,
}

const mockPatientContext: PatientContext = {
  patient: {
    id: 'P001',
    resourceType: 'Patient',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1980-01-01',
    gender: 'male',
    telecom: [
      { system: 'phone', value: '+1-555-0123' },
      { system: 'email', value: 'john.doe@example.com' },
    ],
  },
  diagnosticReports: [],
  serviceRequests: [],
  observations: [],
  tasks: [],
}

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = configureStore({
    reducer: {
      // Add minimal store setup
      auth: (state = { user: null, isAuthenticated: false }) => state,
    },
  })

  return (
    <Provider store={store}>
      <BrowserRouter>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </BrowserRouter>
    </Provider>
  )
}

describe('WorklistPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorklistService.getWorklist.mockResolvedValue(mockWorklistResponse)
    mockFhirService.getPatientContext.mockResolvedValue(mockPatientContext)
  })

  it('loads and displays worklist on mount', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    expect(mockWorklistService.getWorklist).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: {},
      sort: { field: 'studyDate', direction: 'desc' },
      search: '',
    })
  })

  it('handles study selection and shows patient context', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click on a study row
    const studyRow = screen.getByText('John Doe').closest('tr')
    fireEvent.click(studyRow!)

    // Should load patient context
    await waitFor(() => {
      expect(mockFhirService.getPatientContext).toHaveBeenCalledWith('P001')
    })
  })

  it('handles search functionality', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Enter search term
    const searchInput = screen.getByPlaceholderText(/search by patient name/i)
    fireEvent.change(searchInput, { target: { value: 'John' } })

    // Submit search
    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(mockWorklistService.getWorklist).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        filters: {},
        sort: { field: 'studyDate', direction: 'desc' },
        search: 'John',
      })
    })
  })

  it('handles filter application', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Expand filters
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)

    // Select CT modality
    const modalitiesSelect = screen.getByLabelText('Modalities')
    fireEvent.mouseDown(modalitiesSelect)

    const ctOption = screen.getByText('CT')
    fireEvent.click(ctOption)

    // Click outside to close dropdown
    fireEvent.click(document.body)

    await waitFor(() => {
      expect(mockWorklistService.getWorklist).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        filters: { modalities: ['CT'] },
        sort: { field: 'studyDate', direction: 'desc' },
        search: '',
      })
    })
  })

  it('handles sorting', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click on patient name column header to sort
    const patientHeader = screen.getByText('Patient')
    fireEvent.click(patientHeader)

    await waitFor(() => {
      expect(mockWorklistService.getWorklist).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        filters: {},
        sort: { field: 'patientName', direction: 'asc' },
        search: '',
      })
    })
  })

  it('handles pagination', async () => {
    // Mock response with more studies to enable pagination
    const largeResponse: WorklistResponse = {
      ...mockWorklistResponse,
      total: 50,
    }
    mockWorklistService.getWorklist.mockResolvedValue(largeResponse)

    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('50 studies')).toBeInTheDocument()
    })

    // Change page size
    const pageSizeSelect = screen.getByLabelText('Per Page')
    fireEvent.mouseDown(pageSizeSelect)
    
    const fiftyOption = screen.getByText('50')
    fireEvent.click(fiftyOption)

    await waitFor(() => {
      expect(mockWorklistService.getWorklist).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
        filters: {},
        sort: { field: 'studyDate', direction: 'desc' },
        search: '',
      })
    })
  })

  it('handles study assignment', async () => {
    mockWorklistService.assignStudy.mockResolvedValue({
      ...mockStudies[0],
      assignedTo: 'current-user',
    })

    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click assign button
    const assignButtons = screen.getAllByLabelText('Assign Study')
    fireEvent.click(assignButtons[0])

    await waitFor(() => {
      expect(mockWorklistService.assignStudy).toHaveBeenCalledWith(
        '1.2.3.4.5',
        'current-user'
      )
    })

    // Should show success message
    expect(screen.getByText('Study assigned successfully')).toBeInTheDocument()
  })

  it('handles refresh functionality', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Clear previous calls
    mockWorklistService.getWorklist.mockClear()

    // Click refresh button
    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockWorklistService.getWorklist).toHaveBeenCalled()
    })

    // Should show success message
    expect(screen.getByText('Worklist refreshed')).toBeInTheDocument()
  })

  it('navigates to viewer on double-click', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const studyRow = screen.getByText('John Doe').closest('tr')
    
    // First click selects
    fireEvent.click(studyRow!)
    
    // Second click navigates
    fireEvent.click(studyRow!)

    expect(mockNavigate).toHaveBeenCalledWith('/viewer/1.2.3.4.5')
  })

  it('displays AI priority scores correctly', async () => {
    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument() // AI priority score
    })
  })

  it('handles error states gracefully', async () => {
    mockWorklistService.getWorklist.mockRejectedValue(new Error('Network error'))

    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows loading states', async () => {
    // Make the promise never resolve to test loading state
    mockWorklistService.getWorklist.mockImplementation(() => new Promise(() => {}))

    render(
      <TestWrapper>
        <WorklistPage />
      </TestWrapper>
    )

    expect(screen.getByText('Loading worklist...')).toBeInTheDocument()
  })
})