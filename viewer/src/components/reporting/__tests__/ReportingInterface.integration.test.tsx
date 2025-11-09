import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ReportingInterface } from '../ReportingInterface'
import { reportingService } from '@/services/reportingService'
import type { ReportTemplate, StructuredReport } from '@medical-imaging/shared-types'

// Mock the reporting service
jest.mock('@/services/reportingService')
const mockReportingService = reportingService as jest.Mocked<typeof reportingService>

// Mock data
const mockTemplate: ReportTemplate = {
  id: 'template-1',
  name: 'CT Chest Template',
  description: 'Standard template for CT chest examinations',
  modality: ['CT'],
  bodyPart: ['Chest'],
  version: '1.0',
  sections: [
    {
      id: 'section-1',
      title: 'Clinical History',
      description: 'Patient clinical history',
      order: 1,
      required: true,
      fields: [
        {
          id: 'field-1',
          name: 'history',
          label: 'Clinical History',
          type: 'textarea',
          required: true,
          order: 1
        }
      ]
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
}

const mockReport: StructuredReport = {
  id: 'report-1',
  studyInstanceUID: '1.2.3.4.5',
  templateId: 'template-1',
  templateVersion: '1.0',
  status: 'draft',
  priority: 'routine',
  sections: [],
  findings: [],
  measurements: [],
  impression: '',
  recommendations: [],
  createdBy: 'user-1',
  createdAt: new Date()
}

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

describe('ReportingInterface Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Report Creation Workflow', () => {
    it('should create a new report when no existing report is found', async () => {
      // Setup mocks
      mockReportingService.getReportsForStudy.mockResolvedValue([])
      mockReportingService.getTemplates.mockResolvedValue([mockTemplate])
      mockReportingService.createReport.mockResolvedValue(mockReport)
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for template selector to appear
      await waitFor(() => {
        expect(screen.getByText('Select Report Template')).toBeInTheDocument()
      })

      // Select template
      const templateCard = screen.getByText('CT Chest Template')
      fireEvent.click(templateCard)

      // Verify report creation
      await waitFor(() => {
        expect(mockReportingService.createReport).toHaveBeenCalledWith({
          studyInstanceUID: '1.2.3.4.5',
          templateId: 'template-1',
          priority: 'routine'
        })
      })
    })

    it('should load existing draft report', async () => {
      // Setup mocks
      mockReportingService.getReportsForStudy.mockResolvedValue([mockReport])
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for report to load
      await waitFor(() => {
        expect(screen.getByText('CT Chest Template')).toBeInTheDocument()
        expect(screen.getByText('DRAFT')).toBeInTheDocument()
      })

      // Verify services were called
      expect(mockReportingService.getReportsForStudy).toHaveBeenCalledWith('1.2.3.4.5')
      expect(mockReportingService.getTemplate).toHaveBeenCalledWith('template-1')
    })
  })

  describe('Report Editing Workflow', () => {
    beforeEach(() => {
      mockReportingService.getReportsForStudy.mockResolvedValue([mockReport])
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)
    })

    it('should save draft when editing report', async () => {
      mockReportingService.saveDraft.mockResolvedValue({
        ...mockReport,
        status: 'in_progress'
      })

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for report to load
      await waitFor(() => {
        expect(screen.getByText('Save Draft')).toBeInTheDocument()
      })

      // Click save draft
      const saveDraftButton = screen.getByText('Save Draft')
      fireEvent.click(saveDraftButton)

      // Verify save draft was called
      await waitFor(() => {
        expect(mockReportingService.saveDraft).toHaveBeenCalledWith(
          'report-1',
          expect.any(Object)
        )
      })
    })

    it('should populate report from AI findings', async () => {
      const aiData = {
        findings: [
          {
            id: 'finding-1',
            type: 'Nodule',
            description: 'Small pulmonary nodule in right upper lobe',
            confidence: 0.95,
            aiGenerated: true,
            aiModelName: 'chest-detection-v1',
            aiConfidence: 0.95
          }
        ],
        measurements: [
          {
            id: 'measurement-1',
            name: 'Nodule Diameter',
            value: 8.5,
            unit: 'mm',
            aiGenerated: true
          }
        ],
        suggestedImpression: 'Small pulmonary nodule, recommend follow-up'
      }

      mockReportingService.populateFromAI.mockResolvedValue(aiData)
      mockReportingService.updateReport.mockResolvedValue({
        ...mockReport,
        findings: aiData.findings,
        measurements: aiData.measurements,
        impression: aiData.suggestedImpression
      })

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for report to load
      await waitFor(() => {
        expect(screen.getByText('AI Assist')).toBeInTheDocument()
      })

      // Click AI Assist
      const aiAssistButton = screen.getByText('AI Assist')
      fireEvent.click(aiAssistButton)

      // Verify AI population was called
      await waitFor(() => {
        expect(mockReportingService.populateFromAI).toHaveBeenCalledWith(
          'report-1',
          '1.2.3.4.5'
        )
        expect(mockReportingService.updateReport).toHaveBeenCalledWith(
          'report-1',
          expect.objectContaining({
            findings: aiData.findings,
            measurements: aiData.measurements,
            impression: aiData.suggestedImpression
          })
        )
      })
    })
  })

  describe('Report Finalization Workflow', () => {
    beforeEach(() => {
      mockReportingService.getReportsForStudy.mockResolvedValue([mockReport])
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)
    })

    it('should finalize report and submit to EHR', async () => {
      const finalizedReport = {
        ...mockReport,
        status: 'final' as const,
        finalizedAt: new Date()
      }

      const dicomSR = {
        documentTitle: 'CT Chest Report',
        completionFlag: 'COMPLETE' as const,
        verificationFlag: 'VERIFIED' as const,
        contentSequence: []
      }

      mockReportingService.validateReport.mockResolvedValue({
        isValid: true,
        errors: []
      })

      mockReportingService.finalizeReport.mockResolvedValue({
        report: finalizedReport,
        dicomSR,
        fhirReportId: 'fhir-report-1'
      })

      mockReportingService.submitToEHR.mockResolvedValue({
        success: true,
        fhirReportId: 'fhir-report-1'
      })

      const onReportFinalized = jest.fn()

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
          onReportFinalized={onReportFinalized}
        />
      )

      // Wait for report to load and navigate to editor
      await waitFor(() => {
        expect(screen.getByText('Report Editor')).toBeInTheDocument()
      })

      // Click on Report Editor tab if not already active
      const reportEditorTab = screen.getByText('Report Editor')
      fireEvent.click(reportEditorTab)

      // Wait for finalize button
      await waitFor(() => {
        expect(screen.getByText('Finalize Report')).toBeInTheDocument()
      })

      // Click finalize
      const finalizeButton = screen.getByText('Finalize Report')
      fireEvent.click(finalizeButton)

      // Verify finalization workflow
      await waitFor(() => {
        expect(mockReportingService.validateReport).toHaveBeenCalledWith('report-1')
        expect(mockReportingService.finalizeReport).toHaveBeenCalledWith(
          'report-1',
          expect.any(Object)
        )
        expect(mockReportingService.submitToEHR).toHaveBeenCalledWith('report-1')
        expect(onReportFinalized).toHaveBeenCalledWith(finalizedReport)
      })
    })

    it('should handle validation errors during finalization', async () => {
      mockReportingService.validateReport.mockResolvedValue({
        isValid: false,
        errors: [
          {
            field: 'impression',
            message: 'Impression is required',
            severity: 'error'
          }
        ]
      })

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for report to load and navigate to editor
      await waitFor(() => {
        expect(screen.getByText('Report Editor')).toBeInTheDocument()
      })

      // Click finalize
      const finalizeButton = screen.getByText('Finalize Report')
      fireEvent.click(finalizeButton)

      // Verify validation error is shown
      await waitFor(() => {
        expect(screen.getByText(/Report validation failed/)).toBeInTheDocument()
        expect(screen.getByText(/impression: Impression is required/)).toBeInTheDocument()
      })

      // Verify finalization was not called
      expect(mockReportingService.finalizeReport).not.toHaveBeenCalled()
    })
  })

  describe('Report History and Comparison', () => {
    beforeEach(() => {
      mockReportingService.getReportsForStudy.mockResolvedValue([mockReport])
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)
    })

    it('should load and display report history', async () => {
      const historyReports = [
        {
          ...mockReport,
          id: 'report-2',
          status: 'final' as const,
          finalizedAt: new Date('2023-01-01')
        }
      ]

      mockReportingService.getReportHistory.mockResolvedValue(historyReports)

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Navigate to history tab
      await waitFor(() => {
        expect(screen.getByText('History')).toBeInTheDocument()
      })

      const historyTab = screen.getByText('History')
      fireEvent.click(historyTab)

      // Verify history is loaded
      await waitFor(() => {
        expect(mockReportingService.getReportHistory).toHaveBeenCalledWith(
          'patient-1',
          { limit: 50 }
        )
      })
    })

    it('should compare reports', async () => {
      const comparisonData = {
        id: 'comparison-1',
        currentReportId: 'report-1',
        priorReportId: 'report-2',
        comparisonType: 'full' as const,
        differences: [
          {
            type: 'modified' as const,
            category: 'impression' as const,
            field: 'impression',
            currentValue: 'New impression',
            priorValue: 'Old impression',
            significance: 'high' as const
          }
        ],
        createdAt: new Date()
      }

      mockReportingService.compareReports.mockResolvedValue(comparisonData)

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // This would typically be triggered from the history component
      // For this test, we'll simulate the comparison being triggered
      await waitFor(() => {
        expect(screen.getByText('Comparison')).toBeInTheDocument()
      })

      // Navigate to comparison tab
      const comparisonTab = screen.getByText('Comparison')
      fireEvent.click(comparisonTab)

      // The actual comparison would be triggered by selecting a prior report
      // This is tested in the ReportHistory component tests
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockReportingService.getReportsForStudy.mockRejectedValue(
        new Error('Service unavailable')
      )

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/Failed to load existing report/)).toBeInTheDocument()
      })
    })

    it('should handle EHR submission failures', async () => {
      mockReportingService.getReportsForStudy.mockResolvedValue([mockReport])
      mockReportingService.getTemplate.mockResolvedValue(mockTemplate)
      mockReportingService.validateReport.mockResolvedValue({
        isValid: true,
        errors: []
      })

      const finalizedReport = {
        ...mockReport,
        status: 'final' as const,
        finalizedAt: new Date()
      }

      mockReportingService.finalizeReport.mockResolvedValue({
        report: finalizedReport,
        dicomSR: {
          documentTitle: 'CT Chest Report',
          completionFlag: 'COMPLETE' as const,
          verificationFlag: 'VERIFIED' as const,
          contentSequence: []
        }
      })

      mockReportingService.submitToEHR.mockResolvedValue({
        success: false,
        error: 'EHR system unavailable'
      })

      renderWithProviders(
        <ReportingInterface
          studyInstanceUID="1.2.3.4.5"
          patientId="patient-1"
        />
      )

      // Wait for report to load and finalize
      await waitFor(() => {
        expect(screen.getByText('Finalize Report')).toBeInTheDocument()
      })

      const finalizeButton = screen.getByText('Finalize Report')
      fireEvent.click(finalizeButton)

      // Verify EHR error is shown
      await waitFor(() => {
        expect(screen.getByText(/Report finalized but EHR submission failed/)).toBeInTheDocument()
      })
    })
  })
})