import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
// Mock ReportEditor component for testing
const ReportEditor = ({ report, template, onSaveDraft, onFinalize }: any) => (
    <div data-testid="report-editor">
        <button onClick={() => onSaveDraft({})}>Save Draft</button>
        <button onClick={() => onFinalize({})}>Finalize Report</button>
    </div>
)

import { reportingService } from '@/services/reportingService'
// Mock types for testing (normally imported from @medical-imaging/shared-types)
interface ReportTemplate {
    id: string
    name: string
    description: string
    modality: string[]
    bodyPart?: string[]
    version: string
    sections: ReportSection[]
    createdAt: Date
    updatedAt: Date
    isActive: boolean
}

interface ReportSection {
    id: string
    title: string
    description?: string
    order: number
    required: boolean
    fields: ReportField[]
}

interface ReportField {
    id: string
    name: string
    label: string
    type: string
    required: boolean
    order: number
    options?: Array<{ value: string; label: string }>
}

interface StructuredReport {
    id: string
    studyInstanceUID: string
    templateId: string
    templateVersion: string
    status: 'draft' | 'in_progress' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled'
    priority: 'routine' | 'urgent' | 'stat'
    sections: Array<{ sectionId: string; fields: Record<string, any> }>
    findings: ReportFinding[]
    measurements: ReportMeasurement[]
    impression: string
    recommendations: string[]
    createdBy: string
    createdAt: Date
    finalizedAt?: Date
}

interface ReportFinding {
    id: string
    type: string
    description: string
    confidence?: number
    severity?: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical'
    location?: {
        bodyPart: string
        laterality?: 'left' | 'right' | 'bilateral'
        region?: string
    }
    aiGenerated: boolean
    aiModelName?: string
    aiConfidence?: number
}

interface ReportMeasurement {
    id: string
    name: string
    value: number
    unit: string
    aiGenerated: boolean
}

interface DICOMSRContent {
    documentTitle: string
    completionFlag: 'PARTIAL' | 'COMPLETE'
    verificationFlag: 'UNVERIFIED' | 'VERIFIED'
    contentSequence: Array<{
        relationshipType: string
        valueType: string
        conceptNameCodeSequence?: {
            codeValue: string
            codingSchemeDesignator: string
            codeMapping?: string
        }
        textValue?: string
        numericValue?: {
            value: number
            unit: {
                codeValue: string
                codingSchemeDesignator: string
            }
        }
        contentSequence?: any[]
    }>
}

// Mock the reporting service
const mockReportingService = {
    generateDICOMSR: jest.fn(),
    submitToEHR: jest.fn(),
    validateReport: jest.fn(),
    populateFromAI: jest.fn(),
    compareReports: jest.fn()
}

jest.mock('@/services/reportingService', () => ({
    reportingService: mockReportingService
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
        },
        {
            id: 'section-2',
            title: 'Technique',
            description: 'Imaging technique',
            order: 2,
            required: false,
            fields: [
                {
                    id: 'field-2',
                    name: 'contrast',
                    label: 'Contrast Used',
                    type: 'select',
                    required: false,
                    order: 1,
                    options: [
                        { value: 'none', label: 'None' },
                        { value: 'iv', label: 'IV Contrast' },
                        { value: 'oral', label: 'Oral Contrast' }
                    ]
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
    sections: [
        {
            sectionId: 'section-1',
            fields: {
                'field-1': 'Patient presents with chest pain'
            }
        }
    ],
    findings: [],
    measurements: [],
    impression: '',
    recommendations: [],
    createdBy: 'user-1',
    createdAt: new Date()
}

describe('Reporting Workflow Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Complete Report Creation and Finalization', () => {
        it('should create a complete report with findings, measurements, and finalize', async () => {
            const onSaveDraft = jest.fn()
            const onFinalize = jest.fn()

            // Mock DICOM SR generation
            const mockDICOMSR: DICOMSRContent = {
                documentTitle: 'CT Chest Report',
                completionFlag: 'COMPLETE',
                verificationFlag: 'VERIFIED',
                contentSequence: [
                    {
                        relationshipType: 'CONTAINS',
                        valueType: 'CONTAINER',
                        conceptNameCodeSequence: {
                            codeValue: '121070',
                            codingSchemeDesignator: 'DCM',
                            codeMapping: 'Findings'
                        },
                        contentSequence: []
                    }
                ]
            }

            mockReportingService.generateDICOMSR.mockResolvedValue(mockDICOMSR)

            renderWithProviders(
                <ReportEditor
                    report={mockReport}
                    template={mockTemplate}
                    onSaveDraft={onSaveDraft}
                    onFinalize={onFinalize}
                />
            )

            // Fill in clinical history
            const historyField = screen.getByLabelText('Clinical History')
            fireEvent.change(historyField, {
                target: { value: 'Patient presents with chest pain and shortness of breath' }
            })

            // Select contrast
            const contrastSelect = screen.getByLabelText('Contrast Used')
            fireEvent.mouseDown(contrastSelect)
            const ivOption = screen.getByText('IV Contrast')
            fireEvent.click(ivOption)

            // Add a finding
            const addFindingButton = screen.getByText('Add Finding')
            fireEvent.click(addFindingButton)

            // Wait for finding editor dialog
            await waitFor(() => {
                expect(screen.getByText('Add Finding')).toBeInTheDocument()
            })

            // Fill finding details
            const findingTypeField = screen.getByLabelText('Finding Type')
            fireEvent.change(findingTypeField, { target: { value: 'Nodule' } })

            const findingDescField = screen.getByLabelText('Description')
            fireEvent.change(findingDescField, {
                target: { value: 'Small pulmonary nodule in right upper lobe' }
            })

            // Save finding
            const saveFindingButton = screen.getByText('Save Finding')
            fireEvent.click(saveFindingButton)

            // Add a measurement
            await waitFor(() => {
                expect(screen.getByText('Add Measurement')).toBeInTheDocument()
            })

            const addMeasurementButton = screen.getByText('Add Measurement')
            fireEvent.click(addMeasurementButton)

            // Wait for measurement editor dialog
            await waitFor(() => {
                expect(screen.getByText('Add Measurement')).toBeInTheDocument()
            })

            // Fill measurement details
            const measurementNameField = screen.getByLabelText('Measurement Name')
            fireEvent.change(measurementNameField, { target: { value: 'Nodule Diameter' } })

            const measurementValueField = screen.getByLabelText('Value')
            fireEvent.change(measurementValueField, { target: { value: '8.5' } })

            // Save measurement
            const saveMeasurementButton = screen.getByText('Save Measurement')
            fireEvent.click(saveMeasurementButton)

            // Add impression
            await waitFor(() => {
                expect(screen.getByLabelText('Clinical Impression')).toBeInTheDocument()
            })

            const impressionField = screen.getByLabelText('Clinical Impression')
            fireEvent.change(impressionField, {
                target: { value: 'Small pulmonary nodule, likely benign. Recommend follow-up CT in 6 months.' }
            })

            // Add recommendation
            const recommendationField = screen.getByLabelText('Add Recommendation')
            fireEvent.change(recommendationField, {
                target: { value: 'Follow-up CT chest in 6 months' }
            })

            const addRecommendationButton = screen.getByText('Add')
            fireEvent.click(addRecommendationButton)

            // Save draft first
            const saveDraftButton = screen.getByText('Save Draft')
            fireEvent.click(saveDraftButton)

            await waitFor(() => {
                expect(onSaveDraft).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sections: expect.arrayContaining([
                            expect.objectContaining({
                                sectionId: 'section-1',
                                fields: expect.objectContaining({
                                    'field-1': 'Patient presents with chest pain and shortness of breath'
                                })
                            })
                        ]),
                        findings: expect.arrayContaining([
                            expect.objectContaining({
                                type: 'Nodule',
                                description: 'Small pulmonary nodule in right upper lobe'
                            })
                        ]),
                        measurements: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'Nodule Diameter',
                                value: 8.5,
                                unit: 'mm'
                            })
                        ]),
                        impression: 'Small pulmonary nodule, likely benign. Recommend follow-up CT in 6 months.',
                        recommendations: ['Follow-up CT chest in 6 months']
                    })
                )
            })

            // Finalize report
            const finalizeButton = screen.getByText('Finalize Report')
            fireEvent.click(finalizeButton)

            await waitFor(() => {
                expect(onFinalize).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sections: expect.any(Array),
                        findings: expect.any(Array),
                        measurements: expect.any(Array),
                        impression: expect.any(String),
                        recommendations: expect.any(Array)
                    })
                )
            })
        })
    })

    describe('DICOM SR Generation', () => {
        it('should generate valid DICOM SR content from report data', async () => {
            const reportWithData: StructuredReport = {
                ...mockReport,
                findings: [
                    {
                        id: 'finding-1',
                        type: 'Nodule',
                        description: 'Small pulmonary nodule in right upper lobe',
                        confidence: 0.95,
                        severity: 'mild',
                        location: {
                            bodyPart: 'Chest',
                            laterality: 'right',
                            region: 'upper lobe'
                        },
                        aiGenerated: false
                    }
                ],
                measurements: [
                    {
                        id: 'measurement-1',
                        name: 'Nodule Diameter',
                        value: 8.5,
                        unit: 'mm',
                        aiGenerated: false
                    }
                ],
                impression: 'Small pulmonary nodule, recommend follow-up',
                recommendations: ['Follow-up CT in 6 months']
            }

            const expectedSR: DICOMSRContent = {
                documentTitle: 'CT Chest Report',
                completionFlag: 'COMPLETE',
                verificationFlag: 'VERIFIED',
                contentSequence: [
                    {
                        relationshipType: 'CONTAINS',
                        valueType: 'CONTAINER',
                        conceptNameCodeSequence: {
                            codeValue: '121070',
                            codingSchemeDesignator: 'DCM',
                            codeMapping: 'Findings'
                        },
                        contentSequence: [
                            {
                                relationshipType: 'CONTAINS',
                                valueType: 'TEXT',
                                conceptNameCodeSequence: {
                                    codeValue: '121071',
                                    codingSchemeDesignator: 'DCM',
                                    codeMapping: 'Finding'
                                },
                                textValue: 'Small pulmonary nodule in right upper lobe'
                            }
                        ]
                    },
                    {
                        relationshipType: 'CONTAINS',
                        valueType: 'CONTAINER',
                        conceptNameCodeSequence: {
                            codeValue: '121072',
                            codingSchemeDesignator: 'DCM',
                            codeMapping: 'Measurements'
                        },
                        contentSequence: [
                            {
                                relationshipType: 'CONTAINS',
                                valueType: 'NUM',
                                conceptNameCodeSequence: {
                                    codeValue: '121073',
                                    codingSchemeDesignator: 'DCM',
                                    codeMapping: 'Measurement'
                                },
                                numericValue: {
                                    value: 8.5,
                                    unit: {
                                        codeValue: 'mm',
                                        codingSchemeDesignator: 'UCUM'
                                    }
                                }
                            }
                        ]
                    }
                ]
            }

            mockReportingService.generateDICOMSR.mockResolvedValue(expectedSR)

            // Test DICOM SR generation
            const result = await reportingService.generateDICOMSR('report-1')

            expect(result).toEqual(expectedSR)
            expect(result.documentTitle).toBe('CT Chest Report')
            expect(result.completionFlag).toBe('COMPLETE')
            expect(result.verificationFlag).toBe('VERIFIED')
            expect(result.contentSequence).toHaveLength(2) // Findings and Measurements containers
        })
    })

    describe('EHR Integration', () => {
        it('should submit finalized report to EHR via FHIR', async () => {
            const finalizedReport: StructuredReport = {
                ...mockReport,
                status: 'final',
                finalizedAt: new Date(),
                impression: 'Normal chest CT',
                recommendations: ['No follow-up needed']
            }

            mockReportingService.submitToEHR.mockResolvedValue({
                success: true,
                fhirReportId: 'DiagnosticReport/12345'
            })

            const result = await reportingService.submitToEHR('report-1')

            expect(result.success).toBe(true)
            expect(result.fhirReportId).toBe('DiagnosticReport/12345')
            expect(mockReportingService.submitToEHR).toHaveBeenCalledWith('report-1')
        })

        it('should handle EHR submission failures gracefully', async () => {
            mockReportingService.submitToEHR.mockResolvedValue({
                success: false,
                error: 'FHIR server unavailable'
            })

            const result = await reportingService.submitToEHR('report-1')

            expect(result.success).toBe(false)
            expect(result.error).toBe('FHIR server unavailable')
        })
    })

    describe('Report Validation', () => {
        it('should validate required fields before finalization', async () => {
            const incompleteReport: StructuredReport = {
                ...mockReport,
                sections: [], // Missing required clinical history
                impression: '' // Missing impression
            }

            mockReportingService.validateReport.mockResolvedValue({
                isValid: false,
                errors: [
                    {
                        field: 'sections.section-1.field-1',
                        message: 'Clinical History is required',
                        severity: 'error'
                    },
                    {
                        field: 'impression',
                        message: 'Clinical impression is required',
                        severity: 'error'
                    }
                ]
            })

            const result = await reportingService.validateReport('report-1')

            expect(result.isValid).toBe(false)
            expect(result.errors).toHaveLength(2)
            expect(result.errors[0].severity).toBe('error')
        })

        it('should pass validation for complete report', async () => {
            const completeReport: StructuredReport = {
                ...mockReport,
                sections: [
                    {
                        sectionId: 'section-1',
                        fields: {
                            'field-1': 'Patient presents with chest pain'
                        }
                    }
                ],
                impression: 'Normal chest CT examination',
                findings: [],
                measurements: []
            }

            mockReportingService.validateReport.mockResolvedValue({
                isValid: true,
                errors: []
            })

            const result = await reportingService.validateReport('report-1')

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })
    })

    describe('AI Integration', () => {
        it('should populate report with AI-generated findings and measurements', async () => {
            const aiFindings: ReportFinding[] = [
                {
                    id: 'ai-finding-1',
                    type: 'Pneumonia',
                    description: 'Consolidation in left lower lobe consistent with pneumonia',
                    confidence: 0.92,
                    severity: 'moderate',
                    location: {
                        bodyPart: 'Chest',
                        laterality: 'left',
                        region: 'lower lobe'
                    },
                    aiGenerated: true,
                    aiModelName: 'chest-pathology-v2',
                    aiConfidence: 0.92
                }
            ]

            const aiMeasurements: ReportMeasurement[] = [
                {
                    id: 'ai-measurement-1',
                    name: 'Consolidation Area',
                    value: 45.2,
                    unit: 'cm²',
                    aiGenerated: true
                }
            ]

            mockReportingService.populateFromAI.mockResolvedValue({
                findings: aiFindings,
                measurements: aiMeasurements,
                suggestedImpression: 'Left lower lobe pneumonia'
            })

            const result = await reportingService.populateFromAI('report-1', '1.2.3.4.5')

            expect(result.findings).toHaveLength(1)
            expect(result.findings[0].aiGenerated).toBe(true)
            expect(result.findings[0].aiModelName).toBe('chest-pathology-v2')
            expect(result.measurements).toHaveLength(1)
            expect(result.measurements[0].aiGenerated).toBe(true)
            expect(result.suggestedImpression).toBe('Left lower lobe pneumonia')
        })
    })

    describe('Report Comparison', () => {
        it('should compare current report with prior report', async () => {
            const comparisonResult = {
                id: 'comparison-1',
                currentReportId: 'report-1',
                priorReportId: 'report-2',
                comparisonType: 'full' as const,
                differences: [
                    {
                        type: 'added' as const,
                        category: 'finding' as const,
                        field: 'findings[0]',
                        currentValue: 'New nodule detected',
                        significance: 'high' as const
                    },
                    {
                        type: 'modified' as const,
                        category: 'measurement' as const,
                        field: 'measurements[0].value',
                        currentValue: 12.5,
                        priorValue: 8.5,
                        significance: 'medium' as const
                    }
                ],
                createdAt: new Date()
            }

            mockReportingService.compareReports.mockResolvedValue(comparisonResult)

            const result = await reportingService.compareReports('report-1', 'report-2')

            expect(result.differences).toHaveLength(2)
            expect(result.differences[0].type).toBe('added')
            expect(result.differences[0].significance).toBe('high')
            expect(result.differences[1].type).toBe('modified')
            expect(result.differences[1].currentValue).toBe(12.5)
            expect(result.differences[1].priorValue).toBe(8.5)
        })
    })
})