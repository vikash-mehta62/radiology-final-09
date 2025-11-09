import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import WorklistTable from '../WorklistTable'
import type { Study, SortOptions } from '@/types/worklist'

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
    referringPhysician: 'Dr. Smith',
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
            location: { x: 100, y: 150 },
          },
        ],
        processingTime: 5000,
        createdAt: '2024-01-15T14:35:00Z',
      },
    ],
    assignedTo: 'Dr. Johnson',
    assignedAt: '2024-01-15T14:30:00Z',
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

describe('WorklistTable', () => {
  const mockProps = {
    studies: mockStudies,
    loading: false,
    onStudySelect: vi.fn(),
    onStudyAssign: vi.fn(),
    onPriorityChange: vi.fn(),
    onSortChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders study data correctly', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('CT Chest')).toBeInTheDocument()
    expect(screen.getByText('MR Brain')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    render(<WorklistTable {...mockProps} loading={true} />)
    
    expect(screen.getByText('Loading worklist...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('displays empty state when no studies', () => {
    render(<WorklistTable {...mockProps} studies={[]} />)
    
    expect(screen.getByText('No studies found')).toBeInTheDocument()
  })

  it('handles study selection', () => {
    render(<WorklistTable {...mockProps} />)
    
    const firstRow = screen.getByText('John Doe').closest('tr')
    fireEvent.click(firstRow!)
    
    expect(mockProps.onStudySelect).toHaveBeenCalledWith(mockStudies[0])
  })

  it('handles study assignment', () => {
    render(<WorklistTable {...mockProps} />)
    
    const assignButton = screen.getAllByLabelText('Assign Study')[0]
    fireEvent.click(assignButton)
    
    expect(mockProps.onStudyAssign).toHaveBeenCalledWith(mockStudies[0])
  })

  it('displays priority chips with correct colors', () => {
    render(<WorklistTable {...mockProps} />)
    
    const routineChip = screen.getByText('ROUTINE')
    const urgentChip = screen.getByText('URGENT')
    
    expect(routineChip).toBeInTheDocument()
    expect(urgentChip).toBeInTheDocument()
  })

  it('displays AI status and priority score', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument() // AI priority score
  })

  it('handles column sorting', () => {
    render(<WorklistTable {...mockProps} />)
    
    const patientNameHeader = screen.getByText('Patient').closest('span')
    fireEvent.click(patientNameHeader!)
    
    expect(mockProps.onSortChange).toHaveBeenCalledWith({
      field: 'patientName',
      direction: 'asc',
    })
  })

  it('displays assigned user information', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('Dr. Johnson')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('formats dates and times correctly', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
    expect(screen.getByText('Jan 16, 2024')).toBeInTheDocument()
    expect(screen.getByText('14:30')).toBeInTheDocument()
  })

  it('highlights selected study', () => {
    render(<WorklistTable {...mockProps} selectedStudyId="1.2.3.4.5" />)
    
    const selectedRow = screen.getByText('John Doe').closest('tr')
    expect(selectedRow).toHaveClass('Mui-selected')
  })

  it('shows view study action', () => {
    render(<WorklistTable {...mockProps} />)
    
    const viewButtons = screen.getAllByLabelText('View Study')
    expect(viewButtons).toHaveLength(2)
    
    fireEvent.click(viewButtons[0])
    expect(mockProps.onStudySelect).toHaveBeenCalledWith(mockStudies[0])
  })

  it('displays modality chips', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('CT')).toBeInTheDocument()
    expect(screen.getByText('MR')).toBeInTheDocument()
  })

  it('shows accession numbers when available', () => {
    render(<WorklistTable {...mockProps} />)
    
    expect(screen.getByText('Acc: ACC001')).toBeInTheDocument()
  })

  it('handles sort direction toggle', () => {
    const sortOptions: SortOptions = { field: 'patientName', direction: 'asc' }
    render(<WorklistTable {...mockProps} sortOptions={sortOptions} />)
    
    const patientNameHeader = screen.getByText('Patient').closest('span')
    fireEvent.click(patientNameHeader!)
    
    expect(mockProps.onSortChange).toHaveBeenCalledWith({
      field: 'patientName',
      direction: 'desc',
    })
  })
})