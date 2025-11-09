/**
 * Data Retention Scheduled Job
 * Runs automated archival and cleanup processes
 */

const cron = require('node-cron');
const dataRetentionService = require('../services/data-retention-service');

class DataRetentionJob {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    
    // Schedule: Run daily at 2:00 AM
    this.schedule = process.env.RETENTION_JOB_SCHEDULE || '0 2 * * *';
    this.enabled = process.env.ENABLE_AUTO_ARCHIVAL === 'true';
  }

  /**
   * Start the scheduled job
   */
  start() {
    if (!this.enabled) {
      console.log('Data retention job is disabled');
      return;
    }

    console.log(`Starting data retention job with schedule: ${this.schedule}`);

    this.job = cron.schedule(this.schedule, async () => {
      await this.run();
    });

    console.log('Data retention job started');
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      console.log('Data retention job stopped');
    }
  }

  /**
   * Run the data retention process
   */
  async run() {
    if (this.isRunning) {
      console.log('Data retention job is already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    try {
      console.log('=== Starting Data Retention Job ===');
      console.log('Timestamp:', this.lastRun.toISOString());

      // Run automated archival
      const results = await dataRetentionService.runAutomatedArchival();

      console.log('=== Data Retention Job Completed ===');
      console.log('Archives created:', results.archives.length);
      console.log('Records deleted:', results.deletions.reduce((sum, d) => sum + d.deletedCount, 0));

      // Log job completion
      await this.logJobCompletion(results);

    } catch (error) {
      console.error('=== Data Retention Job Failed ===');
      console.error('Error:', error);

      // Log job failure
      await this.logJobFailure(error);

    } finally {
      this.isRunning = false;
      this.calculateNextRun();
    }
  }

  /**
   * Calculate next run time
   */
  calculateNextRun() {
    // Parse cron schedule to calculate next run
    // This is a simplified version - in production, use a proper cron parser
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    this.nextRun = tomorrow;
  }

  /**
   * Log job completion
   */
  async logJobCompletion(results) {
    try {
      const JobLog = require('../models/JobLog');
      await JobLog.create({
        jobName: 'data-retention',
        status: 'completed',
        startTime: this.lastRun,
        endTime: new Date(),
        results,
        error: null
      });
    } catch (error) {
      console.error('Failed to log job completion:', error);
    }
  }

  /**
   * Log job failure
   */
  async logJobFailure(error) {
    try {
      const JobLog = require('../models/JobLog');
      await JobLog.create({
        jobName: 'data-retention',
        status: 'failed',
        startTime: this.lastRun,
        endTime: new Date(),
        results: null,
        error: error.message
      });
    } catch (err) {
      console.error('Failed to log job failure:', err);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      schedule: this.schedule,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.nextRun
    };
  }

  /**
   * Run job manually
   */
  async runManually() {
    console.log('Running data retention job manually...');
    await this.run();
  }
}

// Export singleton instance
const dataRetentionJob = new DataRetentionJob();

module.exports = dataRetentionJob;
