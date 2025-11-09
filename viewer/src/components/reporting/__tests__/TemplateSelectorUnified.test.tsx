/**
 * Unit tests for TemplateSelectorUnified
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateSelectorUnified } from '../TemplateSelectorUnified';
import { reportsApi } from '../../../services/ReportsApi';
import type { ReportTemplate } from '../../../types/reporting';

// Mock the ReportsApi
jest.mock('../../../services/ReportsApi', () => ({
  reportsApi: {
    getTemplates: jest.fn(),
    suggestTemplate: jest.fn(),
    upsert: jest.fn()
  }
}));

// Mock utils
jest.mock('../../../utils/reportingUtils', () => ({
  toast: jest.fn(),
  toastError: jest.fn(),
  telemetryEmit: jest.fn()
}));

describe('TemplateSelectorUnified', () => {
  const mockTemplates: ReportTemplate[] = [
    {
      id: 'chest-ct',
      name: 'Chest CT',
      category: 'Chest',
      modality: 'CT',
      description: 'Standard chest CT template',
      sections: [
        { id: 'findings', label: 'Findings', type: 'textarea' }
      ]
    },
    {
      id: 'brain-mri',
      name: 'Brain MRI',
      category: 'Neuro',
      modality: 'MRI',
      description: 'Brain MRI template',
      sections: [
        { id: 'findings', label: 'Findings', type: 'textarea' }
      ]
    }
  ];

  const mockProps = {
    studyUID: '1.2.3.4.5',
    patientInfo: {
      patientID: 'PAT001',
      patientName: 'John Doe',
      modality: 'CT'
    },
    onTemplateSelect: jest.fn(),
    onBack: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render and load templates', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates,
      count: 2
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    // Should show loading initially
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
      expect(screen.getByText('Brain MRI')).toBeInTheDocument();
    });

    expect(reportsApi.getTemplates).toHaveBeenCalled();
  });

  it('should suggest template based on modality', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    (reportsApi.suggestTemplate as jest.Mock).mockResolvedValue({
      success: true,
      template: mockTemplates[0],
      matchScore: 0.95
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Suggested:/)).toBeInTheDocument();
      expect(screen.getByText(/Chest CT/)).toBeInTheDocument();
    });

    expect(reportsApi.suggestTemplate).toHaveBeenCalledWith({
      modality: 'CT',
      studyDescription: 'auto'
    });
  });

  it('should create draft when template is clicked', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    (reportsApi.upsert as jest.Mock).mockResolvedValue({
      success: true,
      report: {
        reportId: 'REP001',
        studyInstanceUID: '1.2.3.4.5',
        templateId: 'chest-ct',
        reportStatus: 'draft'
      }
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
    });

    // Click on template
    const templateCard = screen.getByText('Chest CT').closest('.MuiCard-root');
    fireEvent.click(templateCard!);

    // Should call upsert to create draft
    await waitFor(() => {
      expect(reportsApi.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          studyInstanceUID: '1.2.3.4.5',
          templateId: 'chest-ct',
          reportStatus: 'draft',
          version: 1,
          creationMode: 'manual'
        })
      );
    });

    // Should call onTemplateSelect with templateId and reportId
    await waitFor(() => {
      expect(mockProps.onTemplateSelect).toHaveBeenCalledWith('chest-ct', 'REP001');
    });
  });

  it('should filter templates by search query', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
      expect(screen.getByText('Brain MRI')).toBeInTheDocument();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'chest' } });

    // Should only show Chest CT
    expect(screen.getByText('Chest CT')).toBeInTheDocument();
    expect(screen.queryByText('Brain MRI')).not.toBeInTheDocument();
  });

  it('should filter templates by modality', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
      expect(screen.getByText('Brain MRI')).toBeInTheDocument();
    });

    // Click MRI filter
    const mriChip = screen.getByText('MRI');
    fireEvent.click(mriChip);

    // Should only show Brain MRI
    expect(screen.queryByText('Chest CT')).not.toBeInTheDocument();
    expect(screen.getByText('Brain MRI')).toBeInTheDocument();
  });

  it('should handle errors gracefully', async () => {
    (reportsApi.getTemplates as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('should disable template during creation', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    (reportsApi.upsert as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
    });

    // Click on template
    const templateCard = screen.getByText('Chest CT').closest('.MuiCard-root');
    fireEvent.click(templateCard!);

    // Should show "Creating draft..." message
    await waitFor(() => {
      expect(screen.getByText('Creating draft...')).toBeInTheDocument();
    });
  });

  it('should call onBack when back button is clicked', async () => {
    (reportsApi.getTemplates as jest.Mock).mockResolvedValue({
      success: true,
      templates: mockTemplates
    });

    render(<TemplateSelectorUnified {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Chest CT')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(mockProps.onBack).toHaveBeenCalled();
  });
});
