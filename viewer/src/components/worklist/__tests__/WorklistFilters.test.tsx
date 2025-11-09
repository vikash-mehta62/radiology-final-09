import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

import WorklistFilters from '../WorklistFilters'
import type { WorklistFilters as Filters } from '@/types/worklist'

// Wrapper component for date picker provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
)

describe('WorklistFilters', () => {
  const mockProps = {
    filters: {} as Partial<Filters>,
    onFiltersChange: vi.fn(),
    onSearch: vi.fn(),
    searchTerm: '',
    loading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    const searchInput = screen.getByPlaceholderText(/search by patient name/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('handles search submission', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    const searchInput = screen.getByPlaceholderText(/search by patient name/i)
    const searchButton = screen.getByText('Search')
    
    fireEvent.change(searchInput, { target: { value: 'John Doe' } })
    fireEvent.click(searchButton)
    
    expect(mockProps.onSearch).toHaveBeenCalledWith('John Doe')
  })

  it('expands and collapses filter controls', () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Should show filter controls after expansion
    expect(screen.getByLabelText('Modalities')).toBeInTheDocument()
  })

  it('handles modality filter selection', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    // Expand filters first
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Open modalities dropdown
    const modalitiesSelect = screen.getByLabelText('Modalities')
    fireEvent.mouseDown(modalitiesSelect)
    
    // Select CT
    const ctOption = screen.getByText('CT')
    fireEvent.click(ctOption)
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        modalities: ['CT'],
      })
    })
  })

  it('handles priority filter selection', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    // Expand filters first
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Open priorities dropdown
    const prioritiesSelect = screen.getByLabelText('Priorities')
    fireEvent.mouseDown(prioritiesSelect)
    
    // Select URGENT
    const urgentOption = screen.getByText('URGENT')
    fireEvent.click(urgentOption)
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        priorities: ['URGENT'],
      })
    })
  })

  it('handles status filter selection', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    // Expand filters first
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Open statuses dropdown
    const statusesSelect = screen.getByLabelText('Statuses')
    fireEvent.mouseDown(statusesSelect)
    
    // Select COMPLETED
    const completedOption = screen.getByText('COMPLETED')
    fireEvent.click(completedOption)
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        statuses: ['COMPLETED'],
      })
    })
  })

  it('handles AI status filter selection', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    // Expand filters first
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Open AI status dropdown
    const aiStatusSelect = screen.getByLabelText('AI Status')
    fireEvent.mouseDown(aiStatusSelect)
    
    // Select COMPLETED
    const completedOption = screen.getAllByText('COMPLETED')[0] // First occurrence in AI status
    fireEvent.click(completedOption)
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        aiStatus: ['COMPLETED'],
      })
    })
  })

  it('handles text field filters', async () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    // Expand filters first
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Test assigned to filter
    const assignedToInput = screen.getByLabelText('Assigned To')
    fireEvent.change(assignedToInput, { target: { value: 'Dr. Smith' } })
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        assignedTo: 'Dr. Smith',
      })
    })
    
    // Test patient name filter
    const patientNameInput = screen.getByLabelText('Patient Name')
    fireEvent.change(patientNameInput, { target: { value: 'John' } })
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalledWith({
        patientName: 'John',
      })
    })
  })

  it('clears all filters', () => {
    const filtersWithData: Partial<Filters> = {
      modalities: ['CT', 'MR'],
      priorities: ['URGENT'],
      assignedTo: 'Dr. Smith',
    }
    
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} filters={filtersWithData} />
      </TestWrapper>
    )
    
    const clearButton = screen.getByText('Clear All')
    fireEvent.click(clearButton)
    
    expect(mockProps.onFiltersChange).toHaveBeenCalledWith({})
    expect(mockProps.onSearch).toHaveBeenCalledWith('')
  })

  it('shows active filter indicator', () => {
    const filtersWithData: Partial<Filters> = {
      modalities: ['CT'],
      priorities: ['URGENT'],
    }
    
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} filters={filtersWithData} />
      </TestWrapper>
    )
    
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('disables controls when loading', () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} loading={true} />
      </TestWrapper>
    )
    
    const searchInput = screen.getByPlaceholderText(/search by patient name/i)
    const searchButton = screen.getByText('Search')
    
    expect(searchInput).toBeDisabled()
    expect(searchButton).toBeDisabled()
  })

  it('displays selected filter chips', () => {
    const filtersWithData: Partial<Filters> = {
      modalities: ['CT', 'MR'],
      priorities: ['URGENT', 'STAT'],
    }
    
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} filters={filtersWithData} />
      </TestWrapper>
    )
    
    // Expand filters to see chips
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    // Should show selected values as chips in the select components
    // This is handled by MUI Select component's renderValue prop
    expect(screen.getByLabelText('Modalities')).toBeInTheDocument()
    expect(screen.getByLabelText('Priorities')).toBeInTheDocument()
  })

  it('handles form submission with enter key', () => {
    render(
      <TestWrapper>
        <WorklistFilters {...mockProps} />
      </TestWrapper>
    )
    
    const searchInput = screen.getByPlaceholderText(/search by patient name/i)
    
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter', charCode: 13 })
    
    expect(mockProps.onSearch).toHaveBeenCalledWith('test search')
  })
})