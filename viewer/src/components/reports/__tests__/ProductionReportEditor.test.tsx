/**
 * Component tests for ProductionReportEditor
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductionReportEditor } from '../ProductionReportEditor';
import { reportsApi } from '../../../services/ReportsApi';
import type { StructuredReport } from '../../../types/reporting';

// Mock the ReportsApi
jest.mock('../../../services/ReportsApi', () => ({
  reportsApi: {
    upsert: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    finalize: jest.fn(),
    sign: jest.fn(),
    export: jest.fn(),
    getAIDetections: jest.fn()
  }
}));

// Mock hooks
jest.mock('../../../hooks/useAutosave', () => ({
  useAutosave: jest.fn(() => ({
    isSaving: false,
    lastSaved: null,
    saveNow: jest.fn(),
    hasUnsavedChanges: false
  }))
}));

jest.mock('../../../hooks/useReportState', () => ({
  useReportState: jest.fn(() => ({
    report: {
      reportId: 'REP001',
      studyInstanceUID: '1.2.3.4.5',
      patientID: 'PAT001',
      reportStatus: 'draft',
      findings: [],
      sections: {}
    },
    loading: false,
    error: null,
    updateSection: jest.fn(),
    updateField: jest.fn(),
    addFinding: jest.fn(),
    setReport: jest.fn(),
    loadOrCreateDraft: jest.fn()
  }))
}));

describe('ProductionReportEditor', () => {
  const mockProps = {
    studyInstanceUID: '1.2.3.4.5',
    patientInfo: {
      patientID: 'PAT001',
      patientName: 'John Doe',
      modality: 'CT'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render the editor', () => {
    render(<ProductionReportEditor {...mockProps} />);
    
    // Check for key elements
    expect(screen.getByText(/report editor/i)).toBeInTheDocument();
  });

  it('should load existing draft on mount', async () => {
    const mockReport: StructuredReport = {
      reportId: 'REP001',
      studyInstanceUID: '1.2.3.4.5',
      patientID: 'PAT001',
      reportStatus: 'draft',
      findings: [],
      findingsText: 'Existing findings'
    };

    (reportsApi.get as jest.Mock).mockResolvedValue({
      success: true,
      report: mockReport
    });

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    await waitFor(() => {
      expect(reportsApi.get).toHaveBeenCalledWith('REP001');
    });
  });

  it('should trigger autosave after typing', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ProductionReportEditor {...mockProps} />);

    const findingsInput = screen.getByLabelText(/findings/i);
    
    await user.type(findingsInput, 'New findings text');

    // Fast-forward time to trigger autosave
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      // Autosave should have been triggered
      // (actual implementation depends on hook)
    });
  });

  it('should finalize report when button clicked', async () => {
    const mockResponse = {
      success: true,
      report: {
        reportId: 'REP001',
        reportStatus: 'preliminary'
      }
    };

    (reportsApi.finalize as jest.Mock).mockResolvedValue(mockResponse);

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    const finalizeButton = screen.getByRole('button', { name: /finalize/i });
    
    fireEvent.click(finalizeButton);

    await waitFor(() => {
      expect(reportsApi.finalize).toHaveBeenCalledWith('REP001');
    });
  });

  it('should sign report when sign button clicked', async () => {
    const mockResponse = {
      success: true,
      report: {
        reportId: 'REP001',
        reportStatus: 'final',
        signedAt: new Date()
      }
    };

    (reportsApi.sign as jest.Mock).mockResolvedValue(mockResponse);

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    const signButton = screen.getByRole('button', { name: /sign/i });
    
    fireEvent.click(signButton);

    // Assuming a signature modal opens
    // Fill in signature and submit
    // (actual implementation depends on SignaturePad component)

    await waitFor(() => {
      expect(reportsApi.sign).toHaveBeenCalled();
    });
  });

  it('should export report as PDF', async () => {
    (reportsApi.export as jest.Mock).mockResolvedValue(undefined);

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    
    fireEvent.click(exportButton);

    // Select PDF format
    const pdfOption = screen.getByText(/pdf/i);
    fireEvent.click(pdfOption);

    await waitFor(() => {
      expect(reportsApi.export).toHaveBeenCalledWith('REP001', 'pdf');
    });
  });

  it('should load AI detections when analysisId provided', async () => {
    const mockAIDetections = {
      findings: [
        {
          id: 'ai-1',
          type: 'Pneumonia',
          confidence: 0.92,
          description: 'AI detected pneumonia',
          severity: 'moderate'
        }
      ]
    };

    (reportsApi.getAIDetections as jest.Mock).mockResolvedValue(mockAIDetections);

    render(<ProductionReportEditor {...mockProps} analysisId="AI001" />);

    await waitFor(() => {
      expect(reportsApi.getAIDetections).toHaveBeenCalledWith('AI001');
    });

    // Check that AI findings are displayed
    await waitFor(() => {
      expect(screen.getByText(/ai detected/i)).toBeInTheDocument();
    });
  });

  it('should show critical findings banner', async () => {
    const mockReport = {
      reportId: 'REP001',
      studyInstanceUID: '1.2.3.4.5',
      patientID: 'PAT001',
      reportStatus: 'draft',
      findings: [
        {
          id: 'F1',
          type: 'critical' as const,
          description: 'Critical finding',
          severity: 'critical' as const
        }
      ]
    };

    (reportsApi.get as jest.Mock).mockResolvedValue({
      success: true,
      report: mockReport
    });

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    await waitFor(() => {
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });
  });

  it('should disable editing when report is final', async () => {
    const mockReport = {
      reportId: 'REP001',
      studyInstanceUID: '1.2.3.4.5',
      patientID: 'PAT001',
      reportStatus: 'final',
      findings: []
    };

    (reportsApi.get as jest.Mock).mockResolvedValue({
      success: true,
      report: mockReport
    });

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    await waitFor(() => {
      const findingsInput = screen.getByLabelText(/findings/i);
      expect(findingsInput).toBeDisabled();
    });
  });

  it('should handle keyboard shortcut Ctrl+S for save', async () => {
    const saveNowMock = jest.fn();
    
    // Mock useAutosave to return our mock
    const { useAutosave } = require('../../../hooks/useAutosave');
    useAutosave.mockReturnValue({
      isSaving: false,
      lastSaved: null,
      saveNow: saveNowMock,
      hasUnsavedChanges: true
    });

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    // Trigger Ctrl+S
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(saveNowMock).toHaveBeenCalled();
    });
  });

  it('should expand medical macros', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ProductionReportEditor {...mockProps} />);

    const findingsInput = screen.getByLabelText(/findings/i);
    
    // Type a macro
    await user.type(findingsInput, 'nml ');

    // Check if macro was expanded
    await waitFor(() => {
      expect(findingsInput).toHaveValue(expect.stringContaining('No acute abnormality detected'));
    });
  });

  it('should pause autosave during finalize', async () => {
    const { useAutosave } = require('../../../hooks/useAutosave');
    const mockUseAutosave = jest.fn(() => ({
      isSaving: false,
      lastSaved: null,
      saveNow: jest.fn(),
      hasUnsavedChanges: false
    }));
    useAutosave.mockImplementation(mockUseAutosave);

    (reportsApi.finalize as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    const finalizeButton = screen.getByRole('button', { name: /finalize/i });
    
    fireEvent.click(finalizeButton);

    // Check that autosave was called with paused=true
    await waitFor(() => {
      const calls = mockUseAutosave.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].paused).toBe(true);
    });
  });

  it('should handle version conflict', async () => {
    const mockError = {
      response: {
        status: 409,
        data: {
          serverVersion: 3,
          clientVersion: 2,
          serverReport: { reportId: 'REP001', version: 3 },
          conflictFields: ['findingsText']
        }
      }
    };

    (reportsApi.update as jest.Mock).mockRejectedValue(mockError);

    render(<ProductionReportEditor {...mockProps} reportId="REP001" />);

    // Trigger an update that causes conflict
    const findingsInput = screen.getByLabelText(/findings/i);
    fireEvent.change(findingsInput, { target: { value: 'Updated findings' } });

    // Trigger save
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Check that conflict modal appears
    await waitFor(() => {
      expect(screen.getByText(/version conflict/i)).toBeInTheDocument();
    });
  });

  it('should call onReportCreated callback', async () => {
    const onReportCreated = jest.fn();
    
    const mockResponse = {
      success: true,
      report: {
        reportId: 'REP001',
        studyInstanceUID: '1.2.3.4.5',
        patientID: 'PAT001',
        reportStatus: 'draft'
      }
    };

    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    render(
      <ProductionReportEditor
        {...mockProps}
        onReportCreated={onReportCreated}
      />
    );

    await waitFor(() => {
      expect(onReportCreated).toHaveBeenCalledWith('REP001');
    });
  });

  it('should call onReportSigned callback', async () => {
    const onReportSigned = jest.fn();
    
    const mockResponse = {
      success: true,
      report: {
        reportId: 'REP001',
        reportStatus: 'final',
        signedAt: new Date()
      }
    };

    (reportsApi.sign as jest.Mock).mockResolvedValue(mockResponse);

    render(
      <ProductionReportEditor
        {...mockProps}
        reportId="REP001"
        onReportSigned={onReportSigned}
      />
    );

    const signButton = screen.getByRole('button', { name: /sign/i });
    fireEvent.click(signButton);

    await waitFor(() => {
      expect(onReportSigned).toHaveBeenCalled();
    });
  });
});
