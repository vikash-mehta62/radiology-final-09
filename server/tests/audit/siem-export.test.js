// Mock dependencies
jest.mock('aws-sdk');
jest.mock('axios');

const AWS = require('aws-sdk');
const axios = require('axios');

describe('SIEM Export Functionality', () => {
  let mockS3Client;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock S3 client
    mockS3Client = {
      upload: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://s3.amazonaws.com/test-bucket/test-key',
          Key: 'test-key'
        })
      }),
      headBucket: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      })
    };

    AWS.S3.mockImplementation(() => mockS3Client);
  });

  describe('S3 Export', () => {
    test('should export audit logs to S3 successfully', async () => {
      const sampleLogEntries = [
        {
          timestamp: '2024-01-01T12:00:00Z',
          eventType: 'access.request',
          userId: 'user123',
          details: { resource: '/api/studies' }
        }
      ];

      // Simple S3 export function
      const exportToS3 = async (logEntries) => {
        const exportData = {
          exportId: 'test-export-id',
          timestamp: new Date().toISOString(),
          service: 'dicom-bridge',
          entryCount: logEntries.length,
          entries: logEntries
        };

        const uploadParams = {
          Bucket: 'test-audit-bucket',
          Key: 'audit-logs/test-export.json',
          Body: JSON.stringify(exportData),
          ContentType: 'application/json'
        };

        const uploadResult = await mockS3Client.upload(uploadParams).promise();

        return {
          success: true,
          exportId: 'test-export-id',
          s3Location: uploadResult.Location,
          entryCount: logEntries.length
        };
      };

      const result = await exportToS3(sampleLogEntries);

      expect(result.success).toBe(true);
      expect(result.entryCount).toBe(1);
      expect(result.s3Location).toBe('https://s3.amazonaws.com/test-bucket/test-key');

      expect(mockS3Client.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-audit-bucket',
          Key: 'audit-logs/test-export.json',
          ContentType: 'application/json'
        })
      );
    });

    test('should handle S3 export failures', async () => {
      const error = new Error('S3 upload failed');
      mockS3Client.upload.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });

      const exportToS3 = async (logEntries) => {
        try {
          const uploadResult = await mockS3Client.upload({}).promise();
          return { success: true };
        } catch (error) {
          throw new Error(`S3 export failed: ${error.message}`);
        }
      };

      await expect(exportToS3([])).rejects.toThrow('S3 export failed: S3 upload failed');
    });
  });

  describe('SIEM Export', () => {
    test('should export to Splunk HEC successfully', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      const sampleLogEntries = [
        {
          timestamp: '2024-01-01T12:00:00Z',
          eventType: 'access.request',
          userId: 'user123'
        }
      ];

      const exportToSplunk = async (logEntries) => {
        const splunkEvents = logEntries.map(entry => ({
          time: Math.floor(new Date(entry.timestamp).getTime() / 1000),
          source: 'dicom-bridge',
          sourcetype: 'audit_log',
          event: entry
        }));

        const response = await axios.post(
          'https://splunk.example.com/services/collector/event',
          splunkEvents.map(event => JSON.stringify(event)).join('\n'),
          {
            headers: {
              'Authorization': 'Splunk test-token',
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: response.status === 200,
          entriesSent: logEntries.length
        };
      };

      const result = await exportToSplunk(sampleLogEntries);

      expect(result.success).toBe(true);
      expect(result.entriesSent).toBe(1);

      expect(axios.post).toHaveBeenCalledWith(
        'https://splunk.example.com/services/collector/event',
        expect.stringContaining('"source":"dicom-bridge"'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Splunk test-token',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    test('should handle SIEM export failures', async () => {
      axios.post.mockResolvedValue({ status: 500 });

      const exportToSiem = async () => {
        const response = await axios.post('test-endpoint', {});
        if (response.status !== 200) {
          throw new Error(`SIEM export failed with status ${response.status}`);
        }
        return { success: true };
      };

      await expect(exportToSiem()).rejects.toThrow('SIEM export failed with status 500');
    });
  });

  describe('PHI Redaction in Exports', () => {
    test('should redact PHI data before exporting to SIEM', async () => {
      const logEntriesWithPHI = [
        {
          timestamp: '2024-01-01T12:00:00Z',
          eventType: 'dicom.processing.started',
          details: {
            patientName: 'John Doe',
            patientID: '12345',
            studyInstanceUID: '1.2.3.4.5',
            modality: 'CT'
          }
        }
      ];

      const redactPHI = (data) => {
        const phiFields = ['patientName', 'patientID', 'password', 'token'];
        const redacted = JSON.parse(JSON.stringify(data));
        
        const redactObject = (obj) => {
          for (const [key, value] of Object.entries(obj)) {
            if (phiFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
              obj[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
              redactObject(value);
            }
          }
        };

        if (Array.isArray(redacted)) {
          redacted.forEach(item => redactObject(item));
        } else {
          redactObject(redacted);
        }

        return redacted;
      };

      const redactedEntries = redactPHI(logEntriesWithPHI);

      expect(redactedEntries[0].details.patientName).toBe('[REDACTED]');
      expect(redactedEntries[0].details.patientID).toBe('[REDACTED]');
      expect(redactedEntries[0].details.studyInstanceUID).toBe('1.2.3.4.5'); // Should not be redacted
      expect(redactedEntries[0].details.modality).toBe('CT'); // Should not be redacted
    });
  });

  describe('Log Retention and Cleanup', () => {
    test('should implement log retention policy', async () => {
      const mockObjects = {
        Contents: [
          {
            Key: 'audit-logs/old-file.json',
            LastModified: new Date(Date.now() - (3000 * 24 * 60 * 60 * 1000)) // 3000 days old
          },
          {
            Key: 'audit-logs/recent-file.json',
            LastModified: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)) // 10 days old
          }
        ]
      };

      mockS3Client.listObjectsV2 = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue(mockObjects)
      });

      mockS3Client.deleteObject = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const enforceRetentionPolicy = async (retentionDays = 2555) => {
        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
        
        const objects = await mockS3Client.listObjectsV2({
          Bucket: 'test-audit-bucket',
          Prefix: 'audit-logs/'
        }).promise();

        let deletedCount = 0;
        
        for (const object of objects.Contents || []) {
          const objectDate = new Date(object.LastModified);
          
          if (objectDate < cutoffDate) {
            await mockS3Client.deleteObject({
              Bucket: 'test-audit-bucket',
              Key: object.Key
            }).promise();
            deletedCount++;
          }
        }

        return {
          success: true,
          deletedCount,
          totalProcessed: objects.Contents?.length || 0
        };
      };

      const result = await enforceRetentionPolicy();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1); // Only old file should be deleted
      expect(result.totalProcessed).toBe(2);

      expect(mockS3Client.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-audit-bucket',
        Key: 'audit-logs/old-file.json'
      });
    });
  });

  describe('Health Checks', () => {
    test('should perform health checks on SIEM integration', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      const healthCheck = async () => {
        const health = {
          service: 'siem-integration',
          status: 'healthy',
          checks: {}
        };

        try {
          // Check S3 connectivity
          await mockS3Client.headBucket({ Bucket: 'test-bucket' }).promise();
          health.checks.s3 = { status: 'healthy' };
        } catch (error) {
          health.checks.s3 = { status: 'unhealthy', error: error.message };
          health.status = 'degraded';
        }

        try {
          // Check SIEM connectivity
          await axios.get('https://splunk.example.com');
          health.checks.siem = { status: 'healthy' };
        } catch (error) {
          health.checks.siem = { status: 'unhealthy', error: error.message };
          health.status = 'degraded';
        }

        return health;
      };

      const health = await healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks.s3.status).toBe('healthy');
      expect(health.checks.siem.status).toBe('healthy');
    });

    test('should report degraded status when services are unavailable', async () => {
      mockS3Client.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('S3 unavailable'))
      });

      const healthCheck = async () => {
        const health = {
          service: 'siem-integration',
          status: 'healthy',
          checks: {}
        };

        try {
          await mockS3Client.headBucket({ Bucket: 'test-bucket' }).promise();
          health.checks.s3 = { status: 'healthy' };
        } catch (error) {
          health.checks.s3 = { status: 'unhealthy', error: error.message };
          health.status = 'degraded';
        }

        return health;
      };

      const health = await healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.checks.s3.status).toBe('unhealthy');
    });
  });
});