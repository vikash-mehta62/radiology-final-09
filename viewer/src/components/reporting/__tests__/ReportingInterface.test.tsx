import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ReportingInterface } from '../ReportingInterface'

// Mock the services
jest.mock('@/services/reportingService', () => ({
  reportingService: {
    getReportsForStudy: jest.fn().mockResolvedValue([]),
    getTemplates: jest.fn().mockResolvedValue([]),
    createReport: jest.fn(),
    getTemplate: jest.fn(),
    saveDraft: jest.fn(),
    updateReport: jest.fn(),
    finalizeReport: jest.fn(),
    submitToEHR: jest.fn(),
    populateFromAI: jest.fn(),
    validateReport: jest.fn(),
    compareReports: jest.fn(),
    getReportHistory: jest.fn().mockResolvedValue([])
  }
}))

const theme = createTheme()

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('ReportingInterface', () => {
  it('should render without crashing', () => {
    renderWithProviders(
      <ReportingInterface
        studyInstanceUID="1.2.3.4.5"
        patientId="patient-1"
      />
    )

    // Should show loading initially
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should show template selector when no existing report', async () => {
    renderWithProviders(
      <ReportingInterface
        studyInstanceUID="1.2.3.4.5"
        patientId="patient-1"
      />
    )

    // Wait for template selector to appear
    await screen.findByText('Select Report Template')
    expect(screen.getByText('Select Report Template')).toBeInTheDocument()
  })
})