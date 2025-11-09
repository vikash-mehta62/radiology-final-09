/**
 * Unit tests for ReportsApi
 */

import axios from 'axios';
import { ReportsApi, reportsApi } from '../ReportsApi';
import type { StructuredReport } from '../../types/reporting';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ReportsApi', () => {
  let api: ReportsApi;

  beforeEach(() => {
    api = new ReportsApi();
    jest.clearAllMocks();
    
    // Mock axios.create to return mocked axios instance
    mockedAxios.create = jest.fn(() => mockedAxios as any);
  });

  describe('upsert', () => {
    it('should create a new report', async () => {
      const mockReport: Partial<StructuredReport> = {
        studyInstanceUID: '1.2.3.4.5',
        patientID: 'PAT001',
        reportStatus: 'draft',
        findings: []
      };

      const mockResponse = {
        data: {
          success: true,
          report: { ...mockReport, reportId: 'REP001' }
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.upsert(mockReport);

      expect(mockedAxios.post).toHaveBeenCalledWith('', mockReport);
      expect(result.report?.reportId).toBe('REP001');
    });

    it('should handle validation errors', async () => {
      const invalidReport = {
        // Missing required fields
        findings: []
      };

      await expect(api.upsert(invalidReport as any)).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should fetch a report by ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            studyInstanceUID: '1.2.3.4.5',
            reportStatus: 'draft'
          }
        }
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.get('REP001');

      expect(mockedAxios.get).toHaveBeenCalledWith('/REP001');
      expect(result.report?.reportId).toBe('REP001');
    });
  });

  describe('update', () => {
    it('should update an existing report', async () => {
      const updates = {
        findingsText: 'Updated findings',
        impression: 'Updated impression'
      };

      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            ...updates,
            version: 2
          }
        }
      };

      mockedAxios.put = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.update('REP001', updates);

      expect(mockedAxios.put).toHaveBeenCalledWith('/REP001', updates);
      expect(result.report?.version).toBe(2);
    });

    it('should handle version conflict (409)', async () => {
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

      mockedAxios.put = jest.fn().mockRejectedValue(mockError);

      await expect(api.update('REP001', {})).rejects.toThrow();
    });
  });

  describe('finalize', () => {
    it('should finalize a report', async () => {
      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            reportStatus: 'preliminary'
          }
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.finalize('REP001');

      expect(mockedAxios.post).toHaveBeenCalledWith('/REP001/finalize');
      expect(result.report?.reportStatus).toBe('preliminary');
    });
  });

  describe('sign', () => {
    it('should sign a report with text signature', async () => {
      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            reportStatus: 'final',
            radiologistSignature: 'Dr. Smith'
          }
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.sign('REP001', {
        signatureText: 'Dr. Smith'
      });

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(result.report?.reportStatus).toBe('final');
    });

    it('should sign a report with image signature', async () => {
      const mockBlob = new Blob(['signature'], { type: 'image/png' });
      
      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            reportStatus: 'final'
          }
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      await api.sign('REP001', {
        signatureImage: mockBlob
      });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callArgs = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(FormData);
    });
  });

  describe('addendum', () => {
    it('should add an addendum to a final report', async () => {
      const mockResponse = {
        data: {
          success: true,
          report: {
            reportId: 'REP001',
            reportStatus: 'amended',
            addenda: [
              {
                content: 'Additional findings noted',
                addedAt: new Date()
              }
            ]
          }
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.addendum('REP001', 'Additional findings noted');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/REP001/addendum',
        { content: 'Additional findings noted', reason: undefined }
      );
      expect(result.report?.reportStatus).toBe('amended');
    });
  });

  describe('export', () => {
    it('should export report as PDF and trigger download', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      
      const mockResponse = {
        data: mockBlob
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      // Mock downloadFile
      const downloadFileSpy = jest.spyOn(api, 'downloadFile').mockImplementation(() => {});

      await api.export('REP001', 'pdf');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/REP001/export',
        expect.objectContaining({
          params: { format: 'pdf' },
          responseType: 'blob'
        })
      );

      expect(downloadFileSpy).toHaveBeenCalledWith(mockBlob, 'report-REP001.pdf');

      downloadFileSpy.mockRestore();
    });

    it('should export report as DICOM SR', async () => {
      const mockBlob = new Blob(['DICOM content'], { type: 'application/dicom' });
      
      const mockResponse = {
        data: mockBlob
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      const downloadFileSpy = jest.spyOn(api, 'downloadFile').mockImplementation(() => {});

      await api.export('REP001', 'dicom-sr');

      expect(downloadFileSpy).toHaveBeenCalledWith(mockBlob, 'report-REP001.dcm');

      downloadFileSpy.mockRestore();
    });

    it('should handle export errors', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { error: 'Export failed' }
        }
      };

      mockedAxios.get = jest.fn().mockRejectedValue(mockError);

      await expect(api.export('REP001', 'pdf')).rejects.toThrow();
    });
  });

  describe('suggestTemplate', () => {
    it('should suggest a template based on modality', async () => {
      const mockResponse = {
        data: {
          success: true,
          template: {
            id: 'chest-ct',
            name: 'Chest CT',
            modality: 'CT'
          },
          matchScore: 0.95
        }
      };

      mockedAxios.post = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.suggestTemplate({
        modality: 'CT',
        studyDescription: 'Chest CT with contrast'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/templates/suggest',
        {
          modality: 'CT',
          studyDescription: 'Chest CT with contrast'
        }
      );

      expect(result.template?.id).toBe('chest-ct');
      expect(result.matchScore).toBe(0.95);
    });
  });

  describe('getTemplates', () => {
    it('should fetch all active templates', async () => {
      const mockResponse = {
        data: {
          success: true,
          templates: [
            { id: 'chest-ct', name: 'Chest CT', active: true },
            { id: 'brain-mri', name: 'Brain MRI', active: true }
          ],
          count: 2
        }
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.getTemplates();

      expect(mockedAxios.get).toHaveBeenCalledWith('/templates?active=true');
      expect(result.templates).toHaveLength(2);
    });
  });

  describe('listByStudy', () => {
    it('should fetch all reports for a study', async () => {
      const mockResponse = {
        data: {
          success: true,
          reports: [
            { reportId: 'REP001', reportStatus: 'draft' },
            { reportId: 'REP002', reportStatus: 'final' }
          ],
          count: 2
        }
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.listByStudy('1.2.3.4.5');

      expect(mockedAxios.get).toHaveBeenCalledWith('/study/1.2.3.4.5');
      expect(result.reports).toHaveLength(2);
    });
  });

  describe('getAIDetections', () => {
    it('should fetch AI detections for analysis', async () => {
      const mockResponse = {
        data: {
          results: {
            detections: [
              {
                label: 'Pneumonia',
                confidence: 0.92,
                bbox: { x: 100, y: 100, w: 50, h: 50 }
              }
            ]
          }
        }
      };

      mockedAxios.get = jest.fn().mockResolvedValue(mockResponse);

      const result = await api.getAIDetections('AI001');

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].type).toBe('Pneumonia');
      expect(result.findings[0].confidence).toBe(0.92);
    });

    it('should return empty findings on error', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      const result = await api.getAIDetections('AI001');

      expect(result.findings).toHaveLength(0);
    });
  });

  describe('downloadFile', () => {
    it('should create a download link and trigger download', () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      
      // Mock DOM methods
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
      const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };

      createElementSpy.mockReturnValue(mockLink as any);

      api.downloadFile(mockBlob, 'test.txt');

      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.download).toBe('test.txt');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Restore mocks
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});
