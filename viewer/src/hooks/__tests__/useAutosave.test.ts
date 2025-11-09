/**
 * Unit tests for useAutosave hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutosave } from '../useAutosave';
import { reportsApi } from '../../services/ReportsApi';
import type { StructuredReport } from '../../types/reporting';

// Mock the ReportsApi
jest.mock('../../services/ReportsApi', () => ({
  reportsApi: {
    upsert: jest.fn(),
    update: jest.fn()
  }
}));

describe('useAutosave', () => {
  const mockReport: Partial<StructuredReport> = {
    studyInstanceUID: '1.2.3.4.5',
    patientID: 'PAT001',
    reportStatus: 'draft',
    findings: [],
    findingsText: 'Test findings'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should not save immediately', () => {
    renderHook(() =>
      useAutosave({
        data: mockReport,
        enabled: true,
        interval: 3000
      })
    );

    expect(reportsApi.upsert).not.toHaveBeenCalled();
  });

  it('should save after interval when data changes', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    const updatedReport = { ...mockReport, findingsText: 'Updated findings' };
    rerender({ data: updatedReport });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(reportsApi.upsert).toHaveBeenCalledWith(updatedReport);
    });
  });

  it('should use update endpoint when reportId exists', async () => {
    const reportWithId = { ...mockReport, reportId: 'REP001' };
    const mockResponse = {
      success: true,
      report: reportWithId
    };
    (reportsApi.update as jest.Mock).mockResolvedValue(mockResponse);

    const { rerender } = renderHook(
      ({ data }) =>
        useAutosave({
          reportId: 'REP001',
          data,
          enabled: true,
          interval: 3000
        }),
      { initialProps: { data: reportWithId } }
    );

    // Change data
    const updatedReport = { ...reportWithId, findingsText: 'Updated findings' };
    rerender({ data: updatedReport });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(reportsApi.update).toHaveBeenCalledWith('REP001', updatedReport);
    });
  });

  it('should debounce multiple changes', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Multiple rapid changes
    rerender({ data: { ...mockReport, findingsText: 'Change 1' } });
    act(() => jest.advanceTimersByTime(1000));

    rerender({ data: { ...mockReport, findingsText: 'Change 2' } });
    act(() => jest.advanceTimersByTime(1000));

    rerender({ data: { ...mockReport, findingsText: 'Change 3' } });
    act(() => jest.advanceTimersByTime(3000));

    // Should only save once with the final change
    await waitFor(() => {
      expect(reportsApi.upsert).toHaveBeenCalledTimes(1);
      expect(reportsApi.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ findingsText: 'Change 3' })
      );
    });
  });

  it('should not save when disabled', () => {
    const { rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: false, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(reportsApi.upsert).not.toHaveBeenCalled();
  });

  it('should call onSaveSuccess callback', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const onSaveSuccess = jest.fn();

    const { rerender } = renderHook(
      ({ data }) =>
        useAutosave({
          data,
          enabled: true,
          interval: 3000,
          onSaveSuccess
        }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledWith(mockResponse.report);
    });
  });

  it('should call onSaveError callback on failure', async () => {
    const mockError = new Error('Network error');
    (reportsApi.upsert as jest.Mock).mockRejectedValue(mockError);

    const onSaveError = jest.fn();

    const { rerender } = renderHook(
      ({ data }) =>
        useAutosave({
          data,
          enabled: true,
          interval: 3000,
          onSaveError
        }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalled();
    });
  });

  it('should handle version conflict (409)', async () => {
    const mockError = {
      response: {
        status: 409,
        data: {
          serverVersion: 2,
          clientVersion: 1,
          serverReport: { ...mockReport, version: 2 },
          conflictFields: ['findingsText']
        }
      }
    };
    (reportsApi.upsert as jest.Mock).mockRejectedValue(mockError);

    const onVersionConflict = jest.fn();

    const { rerender } = renderHook(
      ({ data }) =>
        useAutosave({
          data,
          enabled: true,
          interval: 3000,
          onVersionConflict
        }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(onVersionConflict).toHaveBeenCalledWith({
        serverVersion: 2,
        clientVersion: 1,
        serverReport: expect.any(Object),
        conflictFields: ['findingsText']
      });
    });
  });

  it('should not save if data has not changed', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // First save
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });
    act(() => jest.advanceTimersByTime(3000));

    await waitFor(() => {
      expect(reportsApi.upsert).toHaveBeenCalledTimes(1);
    });

    // No change, should not save again
    act(() => jest.advanceTimersByTime(3000));

    expect(reportsApi.upsert).toHaveBeenCalledTimes(1);
  });

  it('should support manual save with saveNow', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Manual save (don't wait for interval)
    await act(async () => {
      await result.current.saveNow();
    });

    expect(reportsApi.upsert).toHaveBeenCalledTimes(1);
  });

  it('should prevent concurrent saves', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };

    // Simulate slow save
    (reportsApi.upsert as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockResponse), 1000);
        })
    );

    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Trigger first save
    act(() => jest.advanceTimersByTime(3000));

    // Try to trigger second save while first is in flight
    rerender({ data: { ...mockReport, findingsText: 'Another update' } });
    act(() => jest.advanceTimersByTime(3000));

    // Should only call once (second call blocked by in-flight guard)
    expect(reportsApi.upsert).toHaveBeenCalledTimes(1);
  });

  it('should update lastSaved timestamp on successful save', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    expect(result.current.lastSaved).toBeNull();

    // Change data and save
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });
    act(() => jest.advanceTimersByTime(3000));

    await waitFor(() => {
      expect(result.current.lastSaved).toBeInstanceOf(Date);
    });
  });

  it('should track hasUnsavedChanges state', async () => {
    const mockResponse = {
      success: true,
      report: { ...mockReport, reportId: 'REP001' }
    };
    (reportsApi.upsert as jest.Mock).mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, enabled: true, interval: 3000 }),
      { initialProps: { data: mockReport } }
    );

    // Initially no unsaved changes
    expect(result.current.hasUnsavedChanges).toBe(false);

    // Change data
    rerender({ data: { ...mockReport, findingsText: 'Updated findings' } });

    // Should have unsaved changes
    await waitFor(() => {
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    // Save
    act(() => jest.advanceTimersByTime(3000));

    // Should no longer have unsaved changes
    await waitFor(() => {
      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });
});
