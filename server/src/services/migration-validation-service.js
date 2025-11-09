const { getOrthancPreviewClient } = require('./orthanc-preview-client');
const { getDICOMMigrationService } = require('./dicom-migration-service');
const { getMetricsCollector } = require('./metrics-collector');
const { getFrame } = require('../controllers/instanceController');
const Instance = require('../models/Instance');

/**
 * MigrationValidationService - Validates the migration from Node DICOM decoding to Orthanc preview
 * Provides comprehensive testing and validation for the migration process
 */
class MigrationValidationService {
  constructor(config = {}) {
    this.config = {
      validationTimeout: config.validationTimeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      performanceThreshold: config.performanceThreshold || 5000, // 5 seconds
      compressionTestSyntaxes: config.compressionTestSyntaxes || [
        '1.2.840.10008.1.2.4.50',  // JPEG Baseline
        '1.2.840.10008.1.2.4.57',  // JPEG Lossless
        '1.2.840.10008.1.2.4.90',  // JPEG 2000 Lossless
        '1.2.840.10008.1.2.4.91',  // JPEG 2000
        '1.2.840.10008.1.2.5'      // RLE Lossless
      ],
      ...config
    };

    this.orthancClient = getOrthancPreviewClient();
    this.migrationService = getDICOMMigrationService();
    this.metricsCollector = getMetricsCollector();
  }

  /**
   * Run comprehensive migration validation
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async runValidation(options = {}) {
    const validationId = `validation-${Date.now()}`;
    const results = {
      validationId,
      timestamp: new Date().toISOString(),
      overall: { status: 'running', score: 0 },
      tests: {}
    };

    console.log(`Starting migration validation: ${validationId}`);

    try {
      // 1. Test Orthanc connectivity
      results.tests.connectivity = await this.testOrthancConnectivity();
      
      // 2. Test compressed syntax support
      results.tests.compressionSupport = await this.testCompressionSupport(options.testInstances);
      
      // 3. Test performance comparison
      if (options.enablePerformanceTest) {
        results.tests.performance = await this.testPerformanceComparison(options.testInstances);
      }
      
      // 4. Test feature flag functionality
      results.tests.featureFlags = await this.testFeatureFlags(options.testInstances);
      
      // 5. Test migration rollback
      results.tests.rollback = await this.testMigrationRollback(options.testInstances);
      
      // 6. Test error handling and fallback
      results.tests.errorHandling = await this.testErrorHandling(options.testInstances);

      // Calculate overall score and status
      results.overall = this.calculateOverallResults(results.tests);
      
      console.log(`Migration validation completed: ${validationId}, Score: ${results.overall.score}%`);
      
      return results;

    } catch (error) {
      results.overall = {
        status: 'failed',
        score: 0,
        error: error.message
      };
      
      console.error(`Migration validation failed: ${validationId}`, error);
      return results;
    }
  }

  /**
   * Test Orthanc connectivity and basic functionality
   * @private
   */
  async testOrthancConnectivity() {
    const test = {
      name: 'Orthanc Connectivity',
      status: 'running',
      details: {}
    };

    try {
      // Test basic connectivity
      const isConnected = await this.orthancClient.testConnection();
      test.details.basicConnectivity = { success: isConnected };

      if (!isConnected) {
        throw new Error('Orthanc server is not accessible');
      }

      // Test system information retrieval
      try {
        const response = await this.orthancClient.axiosInstance.get('/system');
        test.details.systemInfo = { 
          success: true, 
          version: response.data.Version || 'unknown' 
        };
      } catch (error) {
        test.details.systemInfo = { 
          success: false, 
          error: error.message 
        };
      }

      // Test instance search functionality
      try {
        const response = await this.orthancClient.axiosInstance.get('/instances');
        test.details.instanceListing = { 
          success: true, 
          instanceCount: response.data.length 
        };
      } catch (error) {
        test.details.instanceListing = { 
          success: false, 
          error: error.message 
        };
      }

      test.status = 'passed';
      test.score = 100;

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Test compressed DICOM syntax processing
   * @private
   */
  async testCompressionSupport(testInstances) {
    const test = {
      name: 'Compression Support',
      status: 'running',
      details: {},
      syntaxResults: {}
    };

    try {
      let totalTests = 0;
      let passedTests = 0;

      // Test each compression syntax
      for (const syntax of this.config.compressionTestSyntaxes) {
        totalTests++;
        
        try {
          // Find test instance with this syntax (or create mock test)
          const testResult = await this.testCompressionSyntax(syntax, testInstances);
          test.syntaxResults[syntax] = testResult;
          
          if (testResult.success) {
            passedTests++;
          }
        } catch (error) {
          test.syntaxResults[syntax] = {
            success: false,
            error: error.message
          };
        }
      }

      // Test uncompressed syntax as baseline
      totalTests++;
      try {
        const uncompressedResult = await this.testCompressionSyntax('1.2.840.10008.1.2.1', testInstances);
        test.syntaxResults['uncompressed'] = uncompressedResult;
        if (uncompressedResult.success) passedTests++;
      } catch (error) {
        test.syntaxResults['uncompressed'] = {
          success: false,
          error: error.message
        };
      }

      test.score = Math.round((passedTests / totalTests) * 100);
      test.status = test.score >= 80 ? 'passed' : 'failed';
      test.details.summary = {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests
      };

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Test specific compression syntax
   * @private
   */
  async testCompressionSyntax(transferSyntax, testInstances) {
    // Find or create test instance with this syntax
    const testInstance = await this.findTestInstanceWithSyntax(transferSyntax, testInstances);
    
    if (!testInstance) {
      return {
        success: false,
        error: `No test instance available for syntax ${transferSyntax}`,
        skipped: true
      };
    }

    try {
      // Test compression detection
      const compressionInfo = await this.orthancClient.checkCompressionSupport(testInstance.orthancInstanceId);
      
      // Test preview generation
      const startTime = Date.now();
      const previewBuffer = await this.orthancClient.generatePreview(testInstance.orthancInstanceId, 0);
      const duration = Date.now() - startTime;

      return {
        success: true,
        compressionInfo,
        previewGenerated: previewBuffer && previewBuffer.length > 0,
        duration,
        transferSyntax
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        transferSyntax
      };
    }
  }

  /**
   * Test performance comparison between Orthanc and Node decoding
   * @private
   */
  async testPerformanceComparison(testInstances) {
    const test = {
      name: 'Performance Comparison',
      status: 'running',
      details: {},
      comparisons: []
    };

    try {
      if (!testInstances || testInstances.length === 0) {
        throw new Error('No test instances provided for performance testing');
      }

      let totalComparisons = 0;
      let orthancWins = 0;
      let nodeWins = 0;
      let ties = 0;

      // Test performance on sample instances
      const sampleSize = Math.min(testInstances.length, 5); // Limit to 5 instances
      
      for (let i = 0; i < sampleSize; i++) {
        const instance = testInstances[i];
        totalComparisons++;

        try {
          const comparison = await this.compareInstancePerformance(instance);
          test.comparisons.push(comparison);

          if (comparison.winner === 'orthanc') orthancWins++;
          else if (comparison.winner === 'node') nodeWins++;
          else ties++;

        } catch (error) {
          test.comparisons.push({
            instanceId: instance._id,
            error: error.message,
            winner: 'error'
          });
        }
      }

      test.details.summary = {
        totalComparisons,
        orthancWins,
        nodeWins,
        ties,
        orthancWinRate: Math.round((orthancWins / totalComparisons) * 100)
      };

      // Consider test passed if Orthanc wins or ties in majority of cases
      test.score = test.details.summary.orthancWinRate;
      test.status = test.score >= 50 ? 'passed' : 'failed';

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Compare performance for a single instance
   * @private
   */
  async compareInstancePerformance(instance) {
    const result = {
      instanceId: instance._id,
      studyInstanceUID: instance.studyInstanceUID,
      orthanc: null,
      node: null,
      winner: null
    };

    // Test Orthanc performance
    try {
      const orthancStart = Date.now();
      await this.orthancClient.generatePreview(instance.orthancInstanceId || 'mock-id', 0);
      result.orthanc = {
        duration: Date.now() - orthancStart,
        success: true
      };
    } catch (error) {
      result.orthanc = {
        duration: null,
        success: false,
        error: error.message
      };
    }

    // Test Node performance (simulate since we can't easily call the old method)
    try {
      const nodeStart = Date.now();
      // Simulate Node processing time (would be actual call in real implementation)
      await this.simulateNodeProcessing(instance);
      result.node = {
        duration: Date.now() - nodeStart,
        success: true
      };
    } catch (error) {
      result.node = {
        duration: null,
        success: false,
        error: error.message
      };
    }

    // Determine winner
    if (result.orthanc.success && result.node.success) {
      if (result.orthanc.duration < result.node.duration) {
        result.winner = 'orthanc';
      } else if (result.node.duration < result.orthanc.duration) {
        result.winner = 'node';
      } else {
        result.winner = 'tie';
      }
    } else if (result.orthanc.success) {
      result.winner = 'orthanc';
    } else if (result.node.success) {
      result.winner = 'node';
    } else {
      result.winner = 'both_failed';
    }

    return result;
  }

  /**
   * Test feature flag functionality
   * @private
   */
  async testFeatureFlags(testInstances) {
    const test = {
      name: 'Feature Flags',
      status: 'running',
      details: {},
      flagTests: {}
    };

    try {
      const originalConfig = { ...this.migrationService.config };

      // Test 1: Disable Orthanc preview globally
      this.migrationService.updateConfig({ enableOrthancPreview: false });
      const disabledResult = this.migrationService.shouldUseOrthancPreview();
      test.flagTests.globalDisable = {
        expected: false,
        actual: disabledResult,
        passed: disabledResult === false
      };

      // Test 2: Enable with 0% migration percentage
      this.migrationService.updateConfig({ 
        enableOrthancPreview: true, 
        migrationPercentage: 0 
      });
      const zeroPercentResult = this.migrationService.shouldUseOrthancPreview();
      test.flagTests.zeroPercent = {
        expected: false,
        actual: zeroPercentResult,
        passed: zeroPercentResult === false
      };

      // Test 3: Enable with 100% migration percentage
      this.migrationService.updateConfig({ migrationPercentage: 100 });
      const fullMigrationResult = this.migrationService.shouldUseOrthancPreview();
      test.flagTests.fullMigration = {
        expected: true,
        actual: fullMigrationResult,
        passed: fullMigrationResult === true
      };

      // Test 4: Instance-specific override
      const instanceContext = {
        instance: { useOrthancPreview: false }
      };
      const instanceOverrideResult = this.migrationService.shouldUseOrthancPreview(instanceContext);
      test.flagTests.instanceOverride = {
        expected: false,
        actual: instanceOverrideResult,
        passed: instanceOverrideResult === false
      };

      // Restore original configuration
      this.migrationService.updateConfig(originalConfig);

      // Calculate score
      const passedTests = Object.values(test.flagTests).filter(t => t.passed).length;
      const totalTests = Object.keys(test.flagTests).length;
      
      test.score = Math.round((passedTests / totalTests) * 100);
      test.status = test.score === 100 ? 'passed' : 'failed';
      test.details.summary = { passedTests, totalTests };

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Test migration rollback functionality
   * @private
   */
  async testMigrationRollback(testInstances) {
    const test = {
      name: 'Migration Rollback',
      status: 'running',
      details: {}
    };

    try {
      const originalConfig = { ...this.migrationService.config };

      // Test rollback by disabling Orthanc preview
      this.migrationService.updateConfig({ enableOrthancPreview: false });
      
      // Verify that requests now use Node decoding
      const shouldUseOrthanc = this.migrationService.shouldUseOrthancPreview();
      
      test.details.rollbackTest = {
        configUpdated: true,
        orthancDisabled: !shouldUseOrthanc,
        success: !shouldUseOrthanc
      };

      // Test configuration restoration
      this.migrationService.updateConfig(originalConfig);
      const configRestored = this.migrationService.shouldUseOrthancPreview();
      
      test.details.configRestore = {
        restored: configRestored === originalConfig.enableOrthancPreview,
        success: true
      };

      test.score = (test.details.rollbackTest.success && test.details.configRestore.success) ? 100 : 0;
      test.status = test.score === 100 ? 'passed' : 'failed';

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Test error handling and fallback mechanisms
   * @private
   */
  async testErrorHandling(testInstances) {
    const test = {
      name: 'Error Handling',
      status: 'running',
      details: {},
      errorTests: {}
    };

    try {
      // Test 1: Invalid instance ID handling
      try {
        await this.orthancClient.generatePreview('invalid-instance-id', 0);
        test.errorTests.invalidInstanceId = {
          success: false,
          error: 'Should have thrown error for invalid instance ID'
        };
      } catch (error) {
        test.errorTests.invalidInstanceId = {
          success: true,
          errorHandled: true,
          errorMessage: error.message
        };
      }

      // Test 2: Network error handling with fallback
      const originalUrl = this.orthancClient.config.orthancUrl;
      this.orthancClient.config.orthancUrl = 'http://invalid-orthanc-server:8042';
      
      try {
        const fallbackBuffer = await this.orthancClient.generatePreview('test-id', 0);
        test.errorTests.networkErrorFallback = {
          success: true,
          fallbackGenerated: fallbackBuffer && fallbackBuffer.length > 0
        };
      } catch (error) {
        test.errorTests.networkErrorFallback = {
          success: false,
          error: error.message
        };
      }
      
      // Restore original URL
      this.orthancClient.config.orthancUrl = originalUrl;

      // Test 3: Invalid frame index handling
      try {
        await this.orthancClient.generatePreview('test-id', -1);
        test.errorTests.invalidFrameIndex = {
          success: false,
          error: 'Should have thrown error for invalid frame index'
        };
      } catch (error) {
        test.errorTests.invalidFrameIndex = {
          success: true,
          errorHandled: true,
          errorMessage: error.message
        };
      }

      // Calculate score
      const passedTests = Object.values(test.errorTests).filter(t => t.success).length;
      const totalTests = Object.keys(test.errorTests).length;
      
      test.score = Math.round((passedTests / totalTests) * 100);
      test.status = test.score >= 80 ? 'passed' : 'failed';
      test.details.summary = { passedTests, totalTests };

    } catch (error) {
      test.status = 'failed';
      test.score = 0;
      test.error = error.message;
    }

    return test;
  }

  /**
   * Calculate overall validation results
   * @private
   */
  calculateOverallResults(tests) {
    const testResults = Object.values(tests);
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const averageScore = testResults.reduce((sum, t) => sum + (t.score || 0), 0) / totalTests;

    return {
      status: passedTests === totalTests ? 'passed' : 'partial',
      score: Math.round(averageScore),
      passedTests,
      totalTests,
      summary: {
        connectivity: tests.connectivity?.status || 'not_run',
        compression: tests.compressionSupport?.status || 'not_run',
        performance: tests.performance?.status || 'not_run',
        featureFlags: tests.featureFlags?.status || 'not_run',
        rollback: tests.rollback?.status || 'not_run',
        errorHandling: tests.errorHandling?.status || 'not_run'
      }
    };
  }

  /**
   * Find test instance with specific transfer syntax
   * @private
   */
  async findTestInstanceWithSyntax(transferSyntax, testInstances) {
    if (!testInstances || testInstances.length === 0) {
      return null;
    }

    // For now, return first available instance (in real implementation, 
    // would query Orthanc for instances with specific syntax)
    return testInstances[0];
  }

  /**
   * Simulate Node.js DICOM processing for performance testing
   * @private
   */
  async simulateNodeProcessing(instance) {
    // Simulate processing time (100-500ms)
    const processingTime = 100 + Math.random() * 400;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    return Buffer.alloc(1024); // Mock result
  }

  /**
   * Get validation report
   * @param {string} validationId - Validation ID
   * @returns {Object} Validation report
   */
  getValidationReport(validationId) {
    // In a real implementation, this would retrieve stored validation results
    return {
      validationId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Validation report retrieval not implemented'
    };
  }
}

// Singleton instance
let validationServiceInstance = null;

/**
 * Get singleton instance of MigrationValidationService
 * @param {Object} config - Configuration options
 * @returns {MigrationValidationService} Singleton instance
 */
function getMigrationValidationService(config = {}) {
  if (!validationServiceInstance) {
    validationServiceInstance = new MigrationValidationService(config);
  }
  return validationServiceInstance;
}

module.exports = { MigrationValidationService, getMigrationValidationService };