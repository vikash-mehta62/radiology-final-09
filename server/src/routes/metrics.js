const express = require('express');
const { getMetricsCollector } = require('../services/metrics-collector');

const router = express.Router();

/**
 * GET /metrics - Prometheus metrics endpoint
 * Returns metrics in Prometheus format for scraping
 */
router.get('/', async (req, res) => {
  try {
    const metricsCollector = getMetricsCollector();
    const metrics = await metricsCollector.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * GET /metrics/json - JSON metrics endpoint for debugging
 * Returns metrics in JSON format for easier debugging
 */
router.get('/json', async (req, res) => {
  try {
    const metricsCollector = getMetricsCollector();
    const metrics = await metricsCollector.getMetricsAsJSON();
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: metrics
    });
  } catch (error) {
    console.error('Error collecting JSON metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

module.exports = router;