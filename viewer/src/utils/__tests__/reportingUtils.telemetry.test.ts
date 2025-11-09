import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { telemetryEmit, reportError } from '../reportingUtils';

describe('reportingUtils - Telemetry', () => {
  let eventListener: any;
  let errorListener: any;

  beforeEach(() => {
    // Mock localStorage and sessionStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as any;

    global.sessionStorage = {
      getItem: vi.fn(() => 'test-session-123'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as any;

    // Setup event listeners
    eventListener = vi.fn();
    errorListener = vi.fn();
    
    window.addEventListener('telemetry', eventListener);
    window.addEventListener('reportError', errorListener);
  });

  afterEach(() => {
    window.removeEventListener('telemetry', eventListener);
    window.removeEventListener('reportError', errorListener);
    vi.clearAllMocks();
  });

  describe('telemetryEmit', () => {
    it('should emit telemetry event with correct structure', () => {
      const event = 'report.created';
      const payload = { reportId: 'test-123', templateId: 'template-456' };

      telemetryEmit(event, payload);

      expect(eventListener).toHaveBeenCalledTimes(1);
      
      const customEvent = eventListener.mock.calls[0][0];
      expect(customEvent.detail).toMatchObject({
        event,
        payload,
        sessionId: 'test-session-123',
      });
      expect(customEvent.detail.timestamp).toBeDefined();
    });

    it('should include userId when available', () => {
      const mockUser = { _id: 'user-789', username: 'testuser' };
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify(mockUser));

      telemetryEmit('report.finalized', { reportId: 'test-123' });

      const customEvent = eventListener.mock.calls[0][0];
      expect(customEvent.detail.userId).toBe('user-789');
    });

    it('should handle empty payload', () => {
      telemetryEmit('report.opened');

      expect(eventListener).toHaveBeenCalledTimes(1);
      const customEvent = eventListener.mock.calls[0][0];
      expect(customEvent.detail.payload).toEqual({});
    });

    it('should not throw on error', () => {
      // Simulate error by removing window
      const originalWindow = global.window;
      (global as any).window = undefined;

      expect(() => {
        telemetryEmit('test.event', { data: 'test' });
      }).not.toThrow();

      (global as any).window = originalWindow;
    });
  });

  describe('reportError', () => {
    it('should report error with context', () => {
      const error = new Error('Test error');
      const context = { reportId: 'test-123', action: 'save' };

      reportError(error, context, 'high');

      expect(errorListener).toHaveBeenCalledTimes(1);
      
      const customEvent = errorListener.mock.calls[0][0];
      expect(customEvent.detail).toMatchObject({
        error,
        context,
        severity: 'high',
      });
      expect(customEvent.detail.timestamp).toBeDefined();
    });

    it('should handle string errors', () => {
      const errorMessage = 'Something went wrong';
      
      reportError(errorMessage, {}, 'medium');

      expect(errorListener).toHaveBeenCalledTimes(1);
      const customEvent = errorListener.mock.calls[0][0];
      expect(customEvent.detail.error).toBe(errorMessage);
    });

    it('should default to medium severity', () => {
      reportError('Test error', {});

      const customEvent = errorListener.mock.calls[0][0];
      expect(customEvent.detail.severity).toBe('medium');
    });

    it('should log to console.error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Test error');
      reportError(error, { test: 'context' }, 'critical');

      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration', () => {
    it('should emit multiple events in sequence', () => {
      telemetryEmit('report.created', { reportId: '1' });
      telemetryEmit('report.autosaved', { reportId: '1' });
      telemetryEmit('report.finalized', { reportId: '1' });

      expect(eventListener).toHaveBeenCalledTimes(3);
      
      const events = eventListener.mock.calls.map((call: any) => call[0].detail.event);
      expect(events).toEqual(['report.created', 'report.autosaved', 'report.finalized']);
    });

    it('should handle concurrent telemetry and errors', () => {
      telemetryEmit('report.opened', { reportId: '1' });
      reportError('Network error', { reportId: '1' }, 'high');
      telemetryEmit('report.closed', { reportId: '1' });

      expect(eventListener).toHaveBeenCalledTimes(2);
      expect(errorListener).toHaveBeenCalledTimes(1);
    });
  });
});
